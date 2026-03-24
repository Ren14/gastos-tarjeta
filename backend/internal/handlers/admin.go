package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/cron"
	"github.com/Ren14/gastos-tarjeta/internal/db"
)

// ExportDB streams a SQL backup of the database as INSERT statements.
func ExportDB(w http.ResponseWriter, r *http.Request) {
	date := time.Now().Format("2006-01-02")
	filename := fmt.Sprintf("gastos-tarjeta-backup-%s.sql", date)

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

	if err := executeSQL(r.Context(), content); err != nil {
		http.Error(w, "Restore failed: "+err.Error(), http.StatusInternalServerError)
		return
	}
	writeAdminJSON(w, `{"success":true,"message":"Database restored successfully"}`)
}

// SetupTelegramWebhook registers the webhook URL with Telegram.
func SetupTelegramWebhook(w http.ResponseWriter, r *http.Request) {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	backendURL := os.Getenv("BACKEND_URL")
	secret := os.Getenv("TELEGRAM_WEBHOOK_SECRET")

	if token == "" || backendURL == "" {
		http.Error(w, `{"error":"TELEGRAM_BOT_TOKEN or BACKEND_URL not configured"}`, http.StatusInternalServerError)
		return
	}

	payload, _ := json.Marshal(map[string]string{
		"url":          backendURL + "/telegram/webhook",
		"secret_token": secret,
	})

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/setWebhook", token)
	resp, err := http.Post(apiURL, "application/json", bytes.NewReader(payload))
	if err != nil {
		http.Error(w, `{"error":"Failed to reach Telegram API"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// TriggerDailyCheck manually runs the daily payment reminder job and returns a summary.
func TriggerDailyCheck(w http.ResponseWriter, r *http.Request) {
	summary := cron.RunDailyPaymentReminders()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"sent":   summary.Tomorrow > 0 || summary.Today > 0 || summary.Overdue > 0,
		"groups": summary,
	})
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
		"TRUNCATE split_entries, split_participants, splits, cashflow_entries, expenses, "+
			"recurring_expenses, exchange_rate_history, cashflow_categories, "+
			"flujo_clasificaciones, categories, cards "+
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
			"flujo_clasificaciones",
			"SELECT id, name, sort_order, created_at FROM flujo_clasificaciones ORDER BY id",
		},
		{
			"cashflow_categories",
			"SELECT id, name, type, sort_order, active, clasificacion_id, created_at FROM cashflow_categories ORDER BY id",
		},
		{
			"exchange_rate_history",
			"SELECT id, month, year, usd_to_ars::float8, notes, created_at FROM exchange_rate_history ORDER BY id",
		},
		{
			"recurring_expenses",
			"SELECT id, card_id, category_id, merchant, amount_usd::float8, active, created_at, currency, amount_ars::float8 FROM recurring_expenses ORDER BY id",
		},
		{
			"expenses",
			"SELECT id, card_id, category_id, merchant, total_amount::float8, installments, " +
				"purchase_date::text, notes, color, created_at, recurring_id " +
				"FROM expenses ORDER BY id",
		},
		{
			"cashflow_entries",
			"SELECT id, category_id, month, year, amount::float8, notes, color, created_at FROM cashflow_entries ORDER BY id",
		},
		{
			"splits",
			"SELECT id, recurring_id, name, created_at FROM splits ORDER BY id",
		},
		{
			"split_participants",
			"SELECT id, split_id, name, sort_order, created_at FROM split_participants ORDER BY id",
		},
		{
			"split_entries",
			"SELECT id, split_id, participant_id, month, year, color, created_at FROM split_entries ORDER BY id",
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

// TruncateDB deletes all rows from every table and resets sequences.
// Requires header X-Confirm-Truncate: true.
func TruncateDB(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("X-Confirm-Truncate") != "true" {
		http.Error(w, "Missing header X-Confirm-Truncate: true", http.StatusBadRequest)
		return
	}

	tx, err := db.Pool.Begin(r.Context())
	if err != nil {
		http.Error(w, "Failed to begin transaction: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(),
		`TRUNCATE cashflow_entries, expenses, recurring_expenses, `+
			`exchange_rate_history, cashflow_categories, categories, cards `+
			`RESTART IDENTITY CASCADE`)
	if err != nil {
		http.Error(w, "Truncate failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		http.Error(w, "Commit failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	writeAdminJSON(w, `{"success":true,"message":"All tables truncated successfully"}`)
}

// ── Fallback SQL executor ─────────────────────────────────────────────────────

// safeTruncateStmt replaces any TRUNCATE statement from the backup with a
// DO block that truncates each table only if it exists. This makes old backups
// (generated before certain tables were created) importable without errors.
const safeTruncateStmt = `DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'split_entries') THEN
    TRUNCATE split_entries RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'split_participants') THEN
    TRUNCATE split_participants RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'splits') THEN
    TRUNCATE splits RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cashflow_entries') THEN
    TRUNCATE cashflow_entries RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'expenses') THEN
    TRUNCATE expenses RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recurring_expenses') THEN
    TRUNCATE recurring_expenses RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'exchange_rate_history') THEN
    TRUNCATE exchange_rate_history RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cashflow_categories') THEN
    TRUNCATE cashflow_categories RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'flujo_clasificaciones') THEN
    TRUNCATE flujo_clasificaciones RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'categories') THEN
    TRUNCATE categories RESTART IDENTITY CASCADE;
  END IF;
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cards') THEN
    TRUNCATE cards RESTART IDENTITY CASCADE;
  END IF;
END $$`

func executeSQL(ctx context.Context, content string) error {
	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	for _, stmt := range splitSQL(content) {
		if _, err := tx.Exec(ctx, stmt); err != nil {
			// If an INSERT targets a table that doesn't exist in the current schema
			// (old backup predates a migration), skip it with a warning rather than
			// aborting the whole restore.
			if isUndefinedTableError(err) {
				continue
			}
			return fmt.Errorf("%w\n--- statement ---\n%.400s", err, stmt)
		}
	}
	return tx.Commit(ctx)
}

// isUndefinedTableError returns true when the error is PostgreSQL error code
// 42P01 ("undefined_table"), which happens when a backup INSERT references a
// table that doesn't exist yet in this schema version.
func isUndefinedTableError(err error) bool {
	return strings.Contains(err.Error(), "42P01") ||
		strings.Contains(strings.ToLower(err.Error()), "does not exist")
}

// splitSQL splits a SQL dump into individual executable statements.
// Strips comment lines and skips BEGIN/COMMIT/ROLLBACK (we wrap in our own tx).
// Any TRUNCATE statement is replaced with a safe IF-EXISTS version so that old
// backups (referencing tables not yet created) don't abort the restore.
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
				// Replace any TRUNCATE with the safe IF-EXISTS version.
				if strings.HasPrefix(strings.ToUpper(s), "TRUNCATE") {
					stmts = append(stmts, safeTruncateStmt)
				} else {
					stmts = append(stmts, s)
				}
			}
			buf.Reset()
		}
	}
	if s := strings.TrimSpace(buf.String()); s != "" {
		stmts = append(stmts, s)
	}
	return stmts
}
