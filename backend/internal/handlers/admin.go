package handlers

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/db"
)

// ExportDB streams a SQL backup of the database.
// Tries pg_dump first; falls back to manual INSERT generation.
func ExportDB(w http.ResponseWriter, r *http.Request) {
	date := time.Now().Format("2006-01-02")
	filename := fmt.Sprintf("gastos-tarjeta-backup-%s.sql", date)

	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		if pgDumpPath, err := exec.LookPath("pg_dump"); err == nil {
			cmd := exec.CommandContext(r.Context(), pgDumpPath, "--no-owner", "--no-acl", dbURL)
			if out, err := cmd.Output(); err == nil {
				w.Header().Set("Content-Type", "application/sql")
				w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
				w.Write(out)
				return
			}
		}
	}

	// Fallback: generate INSERT statements manually
	sql, err := manualExport(r.Context())
	if err != nil {
		http.Error(w, "Export failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/sql")
	w.Header().Set("Content-Disposition", `attachment; filename="`+filename+`"`)
	w.Write([]byte(sql))
}

// ImportDB restores the database from an uploaded .sql file.
// Requires header X-Confirm-Restore: true.
func ImportDB(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("X-Confirm-Restore") != "true" {
		http.Error(w, "Missing header X-Confirm-Restore: true", http.StatusBadRequest)
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "Failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "No file uploaded", http.StatusBadRequest)
		return
	}
	defer file.Close()

	sqlBytes, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}
	content := string(sqlBytes)

	// Try psql (handles pg_dump format including dollar-quoted strings, etc.)
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		if psqlPath, err := exec.LookPath("psql"); err == nil {
			cmd := exec.CommandContext(r.Context(), psqlPath, "--single-transaction", dbURL)
			cmd.Stdin = strings.NewReader(content)
			if _, err := cmd.CombinedOutput(); err == nil {
				writeAdminJSON(w, `{"success":true,"message":"Database restored successfully"}`)
				return
			}
		}
	}

	// Fallback: execute statement-by-statement in a transaction
	if err := executeSQL(r.Context(), content); err != nil {
		http.Error(w, "Restore failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeAdminJSON(w, `{"success":true,"message":"Database restored successfully"}`)
}

func writeAdminJSON(w http.ResponseWriter, body string) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprint(w, body)
}

// ── Manual export ─────────────────────────────────────────────────────────────

func manualExport(ctx context.Context) (string, error) {
	var buf bytes.Buffer

	fmt.Fprintf(&buf, "-- gastos-tarjeta backup\n-- Generated: %s UTC\n\n",
		time.Now().UTC().Format("2006-01-02 15:04:05"))
	fmt.Fprintf(&buf, "BEGIN;\n\n")

	// Truncate in reverse FK order; CASCADE handles dependencies
	fmt.Fprintf(&buf,
		"TRUNCATE cashflow_entries, expenses, recurring_expenses, "+
			"exchange_rate_history, cashflow_categories, categories, cards "+
			"RESTART IDENTITY CASCADE;\n\n")

	type tableSpec struct {
		name  string
		query string
	}
	tables := []tableSpec{
		{
			"cards",
			"SELECT id, name, bank, card_type, color_hex, active, created_at FROM cards ORDER BY id",
		},
		{
			"categories",
			"SELECT id, name, icon, color_hex FROM categories ORDER BY id",
		},
		{
			"cashflow_categories",
			"SELECT id, name, type, sort_order, active, created_at FROM cashflow_categories ORDER BY id",
		},
		{
			"exchange_rate_history",
			"SELECT id, month, year, usd_to_ars::float8, notes, created_at FROM exchange_rate_history ORDER BY id",
		},
		{
			"recurring_expenses",
			"SELECT id, card_id, category_id, merchant, amount_usd::float8, active, created_at FROM recurring_expenses ORDER BY id",
		},
		{
			"expenses",
			"SELECT id, card_id, category_id, merchant, total_amount::float8, installments, " +
				"installment_amount::float8, purchase_date::text, notes, color, created_at, recurring_id " +
				"FROM expenses ORDER BY id",
		},
		{
			"cashflow_entries",
			"SELECT id, category_id, month, year, amount::float8, notes, color, created_at FROM cashflow_entries ORDER BY id",
		},
	}

	for _, t := range tables {
		if err := exportTable(ctx, &buf, t.name, t.query); err != nil {
			return "", fmt.Errorf("exporting %s: %w", t.name, err)
		}
	}

	// Reset sequences after explicit-ID inserts
	for _, t := range tables {
		fmt.Fprintf(&buf,
			"SELECT setval('%s_id_seq', COALESCE((SELECT MAX(id) FROM %s), 0) + 1, false);\n",
			t.name, t.name)
	}

	fmt.Fprintf(&buf, "\nCOMMIT;\n")
	return buf.String(), nil
}

func exportTable(ctx context.Context, buf *bytes.Buffer, tableName, query string) error {
	rows, err := db.Pool.Query(ctx, query)
	if err != nil {
		return err
	}
	defer rows.Close()

	descs := rows.FieldDescriptions()
	colNames := make([]string, len(descs))
	for i, d := range descs {
		colNames[i] = d.Name
	}
	colList := strings.Join(colNames, ", ")

	fmt.Fprintf(buf, "-- %s\n", tableName)
	n := 0
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return err
		}
		valStrs := make([]string, len(vals))
		for i, v := range vals {
			valStrs[i] = sqlFormat(v)
		}
		fmt.Fprintf(buf, "INSERT INTO %s (%s) VALUES (%s);\n",
			tableName, colList, strings.Join(valStrs, ", "))
		n++
	}
	if n == 0 {
		fmt.Fprintf(buf, "-- (no rows)\n")
	}
	fmt.Fprintln(buf)
	return rows.Err()
}

func sqlFormat(v interface{}) string {
	if v == nil {
		return "NULL"
	}
	switch val := v.(type) {
	case bool:
		if val {
			return "TRUE"
		}
		return "FALSE"
	case int16:
		return strconv.FormatInt(int64(val), 10)
	case int32:
		return strconv.FormatInt(int64(val), 10)
	case int64:
		return strconv.FormatInt(val, 10)
	case float32:
		return strconv.FormatFloat(float64(val), 'f', -1, 32)
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64)
	case string:
		return "'" + strings.ReplaceAll(val, "'", "''") + "'"
	case []byte:
		return "'" + strings.ReplaceAll(string(val), "'", "''") + "'"
	case time.Time:
		return "'" + val.UTC().Format(time.RFC3339Nano) + "'"
	default:
		s := fmt.Sprintf("%v", val)
		if s == "" {
			return "NULL"
		}
		if _, err := strconv.ParseFloat(s, 64); err == nil {
			return s
		}
		return "'" + strings.ReplaceAll(s, "'", "''") + "'"
	}
}

// ── Fallback SQL executor ─────────────────────────────────────────────────────

func executeSQL(ctx context.Context, content string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, stmt := range splitSQL(content) {
		if _, err := tx.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("%w\n--- statement ---\n%.400s", err, stmt)
		}
	}
	return tx.Commit(ctx)
}

// splitSQL splits a SQL dump into individual executable statements.
// Strips comment lines and skips BEGIN/COMMIT/ROLLBACK (we wrap in our own tx).
func splitSQL(content string) []string {
	var stmts []string
	var buf strings.Builder

	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "--") {
			continue
		}
		upper := strings.ToUpper(strings.TrimRight(trimmed, ";"))
		if upper == "BEGIN" || upper == "COMMIT" || upper == "ROLLBACK" {
			continue
		}
		buf.WriteString(line)
		buf.WriteString("\n")
		if strings.HasSuffix(trimmed, ";") {
			if s := strings.TrimSpace(buf.String()); s != "" {
				stmts = append(stmts, s)
			}
			buf.Reset()
		}
	}
	if s := strings.TrimSpace(buf.String()); s != "" {
		stmts = append(stmts, s)
	}
	return stmts
}
