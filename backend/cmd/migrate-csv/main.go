package main

import (
	"context"
	"encoding/csv"
	"flag"
	"fmt"
	"log"
	"math"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/joho/godotenv"

	"github.com/Ren14/gastos-tarjeta/internal/db"
)

// Monthly columns in the CSV (zero-indexed from column D = index 3)
// abril=4, mayo=5, junio=6, julio=7, agosto=8, sept=9, octubre=10, noviembre=11, diciembre=12
var monthCols = []struct {
	name  string
	month int // 1-12
	year  int
}{
	{"abril", 4, 2026},
	{"mayo", 5, 2026},
	{"junio", 6, 2026},
	{"julio", 7, 2026},
	{"agosto", 8, 2026},
	{"sept", 9, 2026},
	{"octubre", 10, 2025},
	{"noviembre", 11, 2025},
	{"diciembre", 12, 2025},
}

// csvColOffset: the CSV column index of the first monthly amount column (abril)
const csvColOffset = 3 // columns 0=fecha,1=detalle,2=tarjeta, then monthly from 3

// Card holds a DB card record.
type Card struct {
	ID   int
	Name string
}

func main() {
	dryRun := flag.Bool("dry-run", false, "Preview rows without inserting into DB")
	flag.Parse()

	args := flag.Args()
	if len(args) < 1 {
		fmt.Fprintln(os.Stderr, "Usage: migrate-csv [--dry-run] <path/to/file.csv>")
		os.Exit(1)
	}
	csvPath := args[0]

	godotenv.Load()
	db.Connect()
	defer db.Pool.Close()

	ctx := context.Background()

	// ── Load cards from DB ────────────────────────────────────────────────────
	rows, err := db.Pool.Query(ctx, "SELECT id, name FROM cards WHERE active = true ORDER BY id")
	if err != nil {
		log.Fatalf("Failed to load cards: %v", err)
	}
	var cards []Card
	for rows.Next() {
		var c Card
		rows.Scan(&c.ID, &c.Name)
		cards = append(cards, c)
	}
	rows.Close()

	fmt.Printf("Loaded %d cards from DB:\n", len(cards))
	for _, c := range cards {
		fmt.Printf("  [%d] %s\n", c.ID, c.Name)
	}
	fmt.Println()

	// ── Open CSV ──────────────────────────────────────────────────────────────
	f, err := os.Open(csvPath)
	if err != nil {
		log.Fatalf("Cannot open CSV: %v", err)
	}
	defer f.Close()

	reader := csv.NewReader(f)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1 // allow variable column count

	allRows, err := reader.ReadAll()
	if err != nil {
		log.Fatalf("Failed to read CSV: %v", err)
	}

	if len(allRows) < 2 {
		log.Fatalf("CSV has no data rows")
	}

	// Skip header row (row 0); data starts at row 1
	header := allRows[0]
	fmt.Printf("CSV header: %v\n\n", header)

	// ── Process rows ──────────────────────────────────────────────────────────
	var (
		processed int
		inserted  int
		skipped   int
		warnings  []string
	)

	if *dryRun {
		fmt.Println("=== DRY RUN — no data will be written ===\n")
	}

	for rowIdx, row := range allRows[1:] {
		lineNum := rowIdx + 2 // 1-indexed, skipping header

		if len(row) < 3 {
			skipped++
			continue
		}

		// Parse monthly amounts
		type monthAmount struct {
			month int
			year  int
			name  string
			value float64
		}
		var nonEmpty []monthAmount
		for i, mc := range monthCols {
			colIdx := csvColOffset + i
			if colIdx >= len(row) {
				break
			}
			raw := strings.TrimSpace(row[colIdx])
			if raw == "" {
				continue
			}
			val, err := parseAmount(raw)
			if err != nil || val == 0 {
				continue
			}
			nonEmpty = append(nonEmpty, monthAmount{mc.month, mc.year, mc.name, val})
		}

		// Skip rows with no monetary data
		if len(nonEmpty) == 0 {
			skipped++
			continue
		}

		processed++

		dateStr := strings.TrimSpace(row[0])
		merchant := strings.TrimSpace(row[1])
		cardName := strings.TrimSpace(row[2])

		if merchant == "" {
			warnings = append(warnings, fmt.Sprintf("line %d: empty merchant — using \"Sin detalle\"", lineNum))
			merchant = "Sin detalle"
		}

		// Parse purchase date (DD/MM, no year)
		purchaseDate, err := parsePurchaseDate(dateStr)
		if err != nil {
			warnings = append(warnings, fmt.Sprintf("line %d: cannot parse date %q (%v) — using today", lineNum, dateStr, err))
			purchaseDate = time.Now().UTC().Truncate(24 * time.Hour)
		}

		// Validate installment amounts are consistent (should all be equal)
		installmentAmt := nonEmpty[0].value
		for _, ma := range nonEmpty[1:] {
			if math.Abs(ma.value-installmentAmt) > 1.0 {
				warn := fmt.Sprintf("line %d: %q — installment amounts vary (%.2f vs %.2f); using first value",
					lineNum, merchant, installmentAmt, ma.value)
				warnings = append(warnings, warn)
			}
		}

		installments := len(nonEmpty)
		totalAmount := installmentAmt * float64(installments)

		// Find card — create it if not found
		cardID, found := findCard(cards, cardName)
		if !found {
			if *dryRun {
				fmt.Printf("[DRY] ✚ would create card: %q\n", cardName)
				// Assign a placeholder ID so dry-run can continue
				cardID = -(len(cards) + 1)
			} else {
				err = db.Pool.QueryRow(ctx,
					`INSERT INTO cards (name, bank, card_type, color_hex) VALUES ($1, '', 'VISA', '#6b7280') RETURNING id`,
					cardName,
				).Scan(&cardID)
				if err != nil {
					warnings = append(warnings, fmt.Sprintf("line %d: failed to create card %q: %v — skipped", lineNum, cardName, err))
					skipped++
					continue
				}
				fmt.Printf("  ✚ created card: %q (id=%d)\n", cardName, cardID)
			}
			cards = append(cards, Card{ID: cardID, Name: cardName})
		}

		if *dryRun {
			fmt.Printf("[DRY] date=%-12s merchant=%-35s card=%q installments=%d total=%.2f\n",
				purchaseDate.Format("2006-01-02"), merchant, cardName, installments, totalAmount)
			inserted++
			continue
		}

		// Insert into DB — do NOT include installment_amount (it's a generated column)
		_, err = db.Pool.Exec(ctx,
			`INSERT INTO expenses (card_id, merchant, total_amount, installments, purchase_date)
			 VALUES ($1, $2, $3, $4, $5)`,
			cardID, merchant, totalAmount, installments, purchaseDate,
		)
		if err != nil {
			warn := fmt.Sprintf("line %d: DB insert failed for %q: %v — skipped", lineNum, merchant, err)
			warnings = append(warnings, warn)
			skipped++
			continue
		}
		inserted++
	}

	// ── Summary ───────────────────────────────────────────────────────────────
	fmt.Println()
	if len(warnings) > 0 {
		fmt.Printf("=== WARNINGS (%d) ===\n", len(warnings))
		for _, w := range warnings {
			fmt.Println(" ⚠", w)
		}
		fmt.Println()
	}

	action := "inserted"
	if *dryRun {
		action = "would insert"
	}
	fmt.Printf("=== SUMMARY ===\n")
	fmt.Printf("  Rows processed : %d\n", processed)
	fmt.Printf("  Rows %-12s: %d\n", action, inserted)
	fmt.Printf("  Rows skipped   : %d\n", skipped)
	fmt.Printf("  Warnings       : %d\n", len(warnings))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// parseAmount handles both US format (1,500.00 → 1500) and EU format (1.500,00 → 1500).
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
			// US: 1,500.00 — comma is thousands, dot is decimal
			normalized = strings.ReplaceAll(s, ",", "")
		} else {
			// EU: 1.500,00 — dot is thousands, comma is decimal
			normalized = strings.ReplaceAll(s, ".", "")
			normalized = strings.ReplaceAll(normalized, ",", ".")
		}
	case lastComma >= 0:
		// Only comma: treat as decimal separator (EU style)
		normalized = strings.ReplaceAll(s, ",", ".")
	default:
		// Only dot or neither: standard
		normalized = s
	}

	return strconv.ParseFloat(normalized, 64)
}

// parsePurchaseDate parses "DD/MM" applying the year inference rule:
// months 1–9 → 2026, months 10–12 → 2025.
func parsePurchaseDate(s string) (time.Time, error) {
	parts := strings.Split(s, "/")
	if len(parts) != 2 {
		return time.Time{}, fmt.Errorf("expected DD/MM format")
	}
	day, err := strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil || day < 1 || day > 31 {
		return time.Time{}, fmt.Errorf("invalid day %q", parts[0])
	}
	month, err := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err != nil || month < 1 || month > 12 {
		return time.Time{}, fmt.Errorf("invalid month %q", parts[1])
	}
	year := 2026
	if month >= 10 {
		year = 2025
	}
	t := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	// Validate day is real (e.g. Feb 30 would roll over)
	if int(t.Month()) != month {
		return time.Time{}, fmt.Errorf("invalid date %02d/%02d", day, month)
	}
	return t, nil
}

// normalize returns a lowercase, accent-stripped, punctuation-stripped string for fuzzy matching.
func normalize(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		switch r {
		case 'á', 'à', 'â', 'ä':
			b.WriteRune('a')
		case 'é', 'è', 'ê', 'ë':
			b.WriteRune('e')
		case 'í', 'ì', 'î', 'ï':
			b.WriteRune('i')
		case 'ó', 'ò', 'ô', 'ö':
			b.WriteRune('o')
		case 'ú', 'ù', 'û', 'ü':
			b.WriteRune('u')
		case 'ñ':
			b.WriteRune('n')
		default:
			if unicode.IsLetter(r) || unicode.IsDigit(r) || r == ' ' {
				b.WriteRune(r)
			}
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

// findCard tries to match a CSV card name to a DB card using exact then fuzzy matching.
func findCard(cards []Card, csvName string) (int, bool) {
	normCSV := normalize(csvName)

	// 1. Exact normalized match
	for _, c := range cards {
		if normalize(c.Name) == normCSV {
			return c.ID, true
		}
	}

	// 2. One contains the other
	for _, c := range cards {
		n := normalize(c.Name)
		if strings.Contains(n, normCSV) || strings.Contains(normCSV, n) {
			return c.ID, true
		}
	}

	// 3. Word overlap (≥50% of CSV words appear in card name)
	csvWords := strings.Fields(normCSV)
	bestID, bestScore := 0, 0
	for _, c := range cards {
		n := normalize(c.Name)
		matches := 0
		for _, w := range csvWords {
			if strings.Contains(n, w) {
				matches++
			}
		}
		if matches > bestScore {
			bestScore = matches
			bestID = c.ID
		}
	}
	if bestScore > 0 && bestScore >= (len(csvWords)+1)/2 {
		return bestID, true
	}

	return 0, false
}

func cardNames(cards []Card) string {
	names := make([]string, len(cards))
	for i, c := range cards {
		names[i] = fmt.Sprintf("[%d]%s", c.ID, c.Name)
	}
	return strings.Join(names, ", ")
}
