package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/db"
	"github.com/go-chi/chi/v5"
)

// ── Category structs ──────────────────────────────────────────────────────────

type CashflowCategory struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	Type      string `json:"type"` // "income" | "expense"
	SortOrder int    `json:"sort_order"`
	Active    bool   `json:"active"`
}

// ── Entry structs ─────────────────────────────────────────────────────────────

type CashflowEntry struct {
	ID         int     `json:"id"`
	CategoryID int     `json:"category_id"`
	Month      int     `json:"month"`
	Year       int     `json:"year"`
	Amount     float64 `json:"amount"`
	Notes      string  `json:"notes"`
	Color      *string `json:"color"`
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func GetCashflowCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(r.Context(),
		`SELECT id, name, type, sort_order, active FROM cashflow_categories WHERE active = true ORDER BY type, sort_order, name`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	cats := []CashflowCategory{}
	for rows.Next() {
		var c CashflowCategory
		if err := rows.Scan(&c.ID, &c.Name, &c.Type, &c.SortOrder, &c.Active); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		cats = append(cats, c)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cats)
}

func CreateCashflowCategory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name      string `json:"name"`
		Type      string `json:"type"`
		SortOrder int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var c CashflowCategory
	err := db.Pool.QueryRow(r.Context(),
		`INSERT INTO cashflow_categories (name, type, sort_order) VALUES ($1, $2, $3) RETURNING id, name, type, sort_order, active`,
		req.Name, req.Type, req.SortOrder,
	).Scan(&c.ID, &c.Name, &c.Type, &c.SortOrder, &c.Active)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

func UpdateCashflowCategory(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Name      string `json:"name"`
		Type      string `json:"type"`
		SortOrder int    `json:"sort_order"`
		Active    bool   `json:"active"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var c CashflowCategory
	err = db.Pool.QueryRow(r.Context(),
		`UPDATE cashflow_categories SET name=$1, type=$2, sort_order=$3, active=$4 WHERE id=$5 RETURNING id, name, type, sort_order, active`,
		req.Name, req.Type, req.SortOrder, req.Active, id,
	).Scan(&c.ID, &c.Name, &c.Type, &c.SortOrder, &c.Active)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

func GetCashflowEntries(w http.ResponseWriter, r *http.Request) {
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil || year == 0 {
		http.Error(w, "missing year", http.StatusBadRequest)
		return
	}
	rows, err := db.Pool.Query(r.Context(),
		`SELECT id, category_id, month, year, amount, COALESCE(notes, ''), color FROM cashflow_entries WHERE year = $1`,
		year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	entries := []CashflowEntry{}
	for rows.Next() {
		var e CashflowEntry
		if err := rows.Scan(&e.ID, &e.CategoryID, &e.Month, &e.Year, &e.Amount, &e.Notes, &e.Color); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		entries = append(entries, e)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func SaveCashflowEntry(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CategoryID int     `json:"category_id"`
		Month      int     `json:"month"`
		Year       int     `json:"year"`
		Amount     float64 `json:"amount"`
		Notes      string  `json:"notes"`
		Color      *string `json:"color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var e CashflowEntry
	err := db.Pool.QueryRow(r.Context(),
		`INSERT INTO cashflow_entries (category_id, month, year, amount, notes, color)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (category_id, month, year) DO UPDATE
           SET amount = EXCLUDED.amount, notes = EXCLUDED.notes, color = EXCLUDED.color
         RETURNING id, category_id, month, year, amount, COALESCE(notes, ''), color`,
		req.CategoryID, req.Month, req.Year, req.Amount, req.Notes, req.Color,
	).Scan(&e.ID, &e.CategoryID, &e.Month, &e.Year, &e.Amount, &e.Notes, &e.Color)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(e)
}

func DeleteCashflowEntry(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	_, err = db.Pool.Exec(r.Context(), `DELETE FROM cashflow_entries WHERE id = $1`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// GetCardTotals returns total credit card spending per month for the given year.
// Uses the same installment impact logic as GetProjection:
//   - If purchase_date is 2+ days before month end → impacts next month
//   - Otherwise → month after next
//   - Recurring expenses (recurring_id IS NOT NULL) → impact purchase_date month directly
func GetCardTotals(w http.ResponseWriter, r *http.Request) {
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil || year == 0 {
		http.Error(w, "missing year", http.StatusBadRequest)
		return
	}

	// Build 12-month window: Jan–Dec of requested year
	monthDates := make([]time.Time, 12)
	for i := 0; i < 12; i++ {
		monthDates[i] = time.Date(year, time.Month(i+1), 1, 0, 0, 0, 0, time.UTC)
	}
	totals := make([]float64, 12)

	// Query all expenses — fetch enough history to cover installments
	// Use a wide date range: up to 24 months before Jan of requested year
	startDate := time.Date(year-2, 1, 1, 0, 0, 0, 0, time.UTC)
	rows, err := db.Pool.Query(r.Context(),
		`SELECT purchase_date, total_amount, installments,
                (recurring_id IS NOT NULL) AS is_recurring
         FROM expenses
         WHERE purchase_date >= $1`,
		startDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var purchaseDate time.Time
		var totalAmount float64
		var installments int
		var isRecurring bool
		if err := rows.Scan(&purchaseDate, &totalAmount, &installments, &isRecurring); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if installments < 1 {
			installments = 1
		}
		perInstallment := totalAmount / float64(installments)

		purchaseDateStr := purchaseDate.Format("2006-01-02")

		if isRecurring {
			// Recurring: impact directly in purchase_date month
			pdMonth := int(purchaseDate.Month())
			pdYear := purchaseDate.Year()
			for i, target := range monthDates {
				if int(target.Month()) == pdMonth && target.Year() == pdYear {
					totals[i] += totalAmount
					break
				}
			}
		} else {
			// Regular: apply installment impact logic
			firstImpact := getFirstImpactMonth(purchaseDateStr)
			for inst := 0; inst < installments; inst++ {
				mo := int(firstImpact.Month()) + inst
				yr := firstImpact.Year()
				for mo > 12 {
					mo -= 12
					yr++
				}
				if yr == year {
					idx := mo - 1
					if idx >= 0 && idx < 12 {
						totals[idx] += perInstallment
					}
				}
			}
		}
	}

	// Return as array of {month:1..12, total:float64}
	type MonthTotal struct {
		Month int     `json:"month"`
		Total float64 `json:"total"`
	}
	result := make([]MonthTotal, 12)
	for i := 0; i < 12; i++ {
		result[i] = MonthTotal{Month: i + 1, Total: totals[i]}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
