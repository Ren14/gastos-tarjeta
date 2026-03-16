package main

import (
	"context"
	"encoding/csv"
	"flag"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"

	"github.com/Ren14/gastos-tarjeta/internal/db"
)

// Supported month names → month number.
var monthIndex = map[string]int{
	"enero":      1,
	"febrero":    2,
	"marzo":      3,
	"abril":      4,
	"mayo":       5,
	"junio":      6,
	"julio":      7,
	"agosto":     8,
	"septiembre": 9,
	"sept":       9,
	"sep":        9,
	"octubre":    10,
	"noviembre":  11,
	"diciembre":  12,
}

func main() {
	filePath := flag.String("file", "", "Path to the CSV file (required)")
	catType  := flag.String("type", "", "Category type: income or expense (required)")
	year     := flag.Int("year", 2026, "Year for the entries")
	dryRun   := flag.Bool("dry-run", false, "Preview without writing to DB")
	flag.Parse()

	if *filePath == "" || (*catType != "income" && *catType != "expense") {
		fmt.Fprintln(os.Stderr, "Usage: migrate-cashflow --file <path.csv> --type <income|expense> [--year 2026] [--dry-run]")
		os.Exit(1)
	}

	godotenv.Load()
	db.Connect()
	defer db.Pool.Close()

	ctx := context.Background()

	// ── Open CSV ──────────────────────────────────────────────────────────────
	f, err := os.Open(*filePath)
	if err != nil {
		log.Fatalf("Cannot open file: %v", err)
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1

	allRows, err := reader.ReadAll()
	if err != nil {
		log.Fatalf("Failed to read CSV: %v", err)
	}
	if len(allRows) < 2 {
		log.Fatalf("CSV has no data rows")
	}

	// ── Parse header row → month columns ─────────────────────────────────────
	header := allRows[0]
	type colMonth struct {
		colIdx int
		month  int
	}
	var monthCols []colMonth
	for i := 1; i < len(header); i++ {
		name := strings.ToLower(strings.TrimSpace(header[i]))
		if m, ok := monthIndex[name]; ok {
			monthCols = append(monthCols, colMonth{i, m})
		}
	}
	if len(monthCols) == 0 {
		log.Fatalf("No recognized month columns found in header: %v", header)
	}

	fmt.Printf("File   : %s\n", *filePath)
	fmt.Printf("Type   : %s\n", *catType)
	fmt.Printf("Year   : %d\n", *year)
	months := make([]string, len(monthCols))
	for i, mc := range monthCols {
		months[i] = fmt.Sprintf("%s(%d)", header[mc.colIdx], mc.month)
	}
	fmt.Printf("Months : %s\n\n", strings.Join(months, ", "))

	if *dryRun {
		fmt.Println("=== DRY RUN — no data will be written ===\n")
	}

	// ── Process rows ──────────────────────────────────────────────────────────
	var (
		catsCreated  int
		catsReused   int
		entriesUpserted int
		rowsSkipped  int
	)

	for rowIdx, row := range allRows[1:] {
		if len(row) == 0 {
			rowsSkipped++
			continue
		}
		catName := strings.TrimSpace(row[0])
		if catName == "" {
			rowsSkipped++
			continue
		}

		sortOrder := rowIdx + 1

		// Collect non-empty amounts for this row
		type entry struct {
			month  int
			amount float64
		}
		var entries []entry
		for _, mc := range monthCols {
			if mc.colIdx >= len(row) {
				continue
			}
			raw := strings.TrimSpace(row[mc.colIdx])
			if raw == "" {
				continue
			}
			val, err := parseAmount(raw)
			if err != nil || val == 0 {
				continue
			}
			entries = append(entries, entry{mc.month, val})
		}

		if len(entries) == 0 {
			rowsSkipped++
			continue
		}

		// ── Find or create category ───────────────────────────────────────────
		var categoryID int

		if *dryRun {
			// In dry-run, check if category exists just for reporting
			err := db.Pool.QueryRow(ctx,
				`SELECT id FROM cashflow_categories WHERE name = $1 AND type = $2 LIMIT 1`,
				catName, *catType,
			).Scan(&categoryID)
			if err != nil {
				fmt.Printf("[DRY] ✚ would create category: %q (type=%s, sort_order=%d)\n", catName, *catType, sortOrder)
				catsCreated++
			} else {
				fmt.Printf("[DRY]    reuse category id=%d: %q\n", categoryID, catName)
				catsReused++
			}
			for _, e := range entries {
				fmt.Printf("[DRY]      → month=%02d year=%d amount=%.2f\n", e.month, *year, e.amount)
				entriesUpserted++
			}
			continue
		}

		// Real mode: find or create
		err = db.Pool.QueryRow(ctx,
			`SELECT id FROM cashflow_categories WHERE name = $1 AND type = $2 LIMIT 1`,
			catName, *catType,
		).Scan(&categoryID)
		if err != nil {
			// Not found — create it
			err = db.Pool.QueryRow(ctx,
				`INSERT INTO cashflow_categories (name, type, sort_order) VALUES ($1, $2, $3) RETURNING id`,
				catName, *catType, sortOrder,
			).Scan(&categoryID)
			if err != nil {
				fmt.Printf("  ✗ failed to create category %q: %v — skipping row\n", catName, err)
				rowsSkipped++
				continue
			}
			fmt.Printf("  ✚ created category id=%d: %q\n", categoryID, catName)
			catsCreated++
		} else {
			fmt.Printf("  ↻ reused  category id=%d: %q\n", categoryID, catName)
			catsReused++
		}

		// ── Upsert entries ────────────────────────────────────────────────────
		for _, e := range entries {
			_, err := db.Pool.Exec(ctx,
				`INSERT INTO cashflow_entries (category_id, month, year, amount)
				 VALUES ($1, $2, $3, $4)
				 ON CONFLICT (category_id, month, year) DO UPDATE SET amount = EXCLUDED.amount`,
				categoryID, e.month, *year, e.amount,
			)
			if err != nil {
				fmt.Printf("    ✗ failed entry month=%02d amount=%.2f: %v\n", e.month, e.amount, err)
				continue
			}
			fmt.Printf("    → month=%02d year=%d amount=%.2f\n", e.month, *year, e.amount)
			entriesUpserted++
		}
	}

	// ── Summary ───────────────────────────────────────────────────────────────
	fmt.Println()
	fmt.Println("=== SUMMARY ===")
	fmt.Printf("  Categories created : %d\n", catsCreated)
	fmt.Printf("  Categories reused  : %d\n", catsReused)
	if *dryRun {
		fmt.Printf("  Entries would upsert: %d\n", entriesUpserted)
	} else {
		fmt.Printf("  Entries upserted   : %d\n", entriesUpserted)
	}
	fmt.Printf("  Rows skipped       : %d\n", rowsSkipped)
}

// parseAmount handles US format (1,500.00 → 1500) and EU format (1.500,00 → 1500).
func parseAmount(s string) (float64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, nil
	}

	lastDot   := strings.LastIndex(s, ".")
	lastComma := strings.LastIndex(s, ",")

	var normalized string
	switch {
	case lastDot >= 0 && lastComma >= 0:
		if lastDot > lastComma {
			// US: 1,500.00 — comma=thousands, dot=decimal
			normalized = strings.ReplaceAll(s, ",", "")
		} else {
			// EU: 1.500,00 — dot=thousands, comma=decimal
			normalized = strings.ReplaceAll(s, ".", "")
			normalized = strings.ReplaceAll(normalized, ",", ".")
		}
	case lastComma >= 0:
		normalized = strings.ReplaceAll(s, ",", ".")
	default:
		normalized = s
	}

	return strconv.ParseFloat(normalized, 64)
}
