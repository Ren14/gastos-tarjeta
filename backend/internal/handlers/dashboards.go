package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/db"
)

// ── Shared helper ─────────────────────────────────────────────────────────────

// computeMonthlyCardTotals replicates the GetCardTotals logic and returns the
// 12-month per-month aggregate totals for the given year.
func computeMonthlyCardTotals(ctx context.Context, year int) ([]float64, error) {
	monthDates := make([]time.Time, 12)
	for i := 0; i < 12; i++ {
		monthDates[i] = time.Date(year, time.Month(i+1), 1, 0, 0, 0, 0, time.UTC)
	}
	totals := make([]float64, 12)

	recurringMerchantSet := map[string]bool{}
	rmRows, err := db.Pool.Query(ctx, "SELECT merchant FROM recurring_expenses WHERE active = true")
	if err != nil {
		return nil, err
	}
	defer rmRows.Close()
	for rmRows.Next() {
		var m string
		rmRows.Scan(&m)
		recurringMerchantSet[normalizeMerchant(m)] = true
	}

	startDate := time.Date(year-2, 1, 1, 0, 0, 0, 0, time.UTC)
	rows, err := db.Pool.Query(ctx,
		`SELECT purchase_date, total_amount, installments,
		        (recurring_id IS NOT NULL) AS is_recurring, merchant
		 FROM expenses WHERE purchase_date >= $1`, startDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var purchaseDate time.Time
		var totalAmount float64
		var installments int
		var isRecurring bool
		var merchant string
		if err := rows.Scan(&purchaseDate, &totalAmount, &installments, &isRecurring, &merchant); err != nil {
			return nil, err
		}
		if installments < 1 {
			installments = 1
		}
		perInstallment := totalAmount / float64(installments)
		if isRecurring {
			pdMonth, pdYear := int(purchaseDate.Month()), purchaseDate.Year()
			for i, t := range monthDates {
				if int(t.Month()) == pdMonth && t.Year() == pdYear {
					totals[i] += totalAmount
					break
				}
			}
		} else {
			if recurringMerchantSet[normalizeMerchant(merchant)] {
				continue
			}
			firstImpact := getFirstImpactMonth(purchaseDate.Format("2006-01-02"))
			for inst := 0; inst < installments; inst++ {
				mo := int(firstImpact.Month()) + inst
				yr := firstImpact.Year()
				for mo > 12 {
					mo -= 12
					yr++
				}
				if yr == year {
					if idx := mo - 1; idx >= 0 && idx < 12 {
						totals[idx] += perInstallment
					}
				}
			}
		}
	}

	// Estimated recurring for ungenerated current/future months
	generatedMonths := map[monthKey]bool{}
	genRows, err := db.Pool.Query(ctx,
		`SELECT DISTINCT EXTRACT(MONTH FROM purchase_date)::int, EXTRACT(YEAR FROM purchase_date)::int
		 FROM expenses WHERE recurring_id IS NOT NULL`)
	if err != nil {
		return nil, err
	}
	defer genRows.Close()
	for genRows.Next() {
		var m, y int
		genRows.Scan(&m, &y)
		generatedMonths[monthKey{m, y}] = true
	}

	type recItem struct {
		AmountUSD float64
		AmountARS *float64
		Currency  string
	}
	var recItems []recItem
	recRows, err := db.Pool.Query(ctx,
		"SELECT amount_usd, amount_ars, currency FROM recurring_expenses WHERE active = true")
	if err != nil {
		return nil, err
	}
	defer recRows.Close()
	for recRows.Next() {
		var ri recItem
		recRows.Scan(&ri.AmountUSD, &ri.AmountARS, &ri.Currency)
		recItems = append(recItems, ri)
	}

	var latestRate float64
	db.Pool.QueryRow(ctx,
		"SELECT usd_to_ars FROM exchange_rate_history ORDER BY year DESC, month DESC LIMIT 1",
	).Scan(&latestRate)

	hasUSD := false
	for _, ri := range recItems {
		if ri.Currency == "USD" {
			hasUSD = true
			break
		}
	}
	if len(recItems) > 0 && (!hasUSD || latestRate > 0) {
		now := time.Now()
		cur := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
		for i, t := range monthDates {
			if t.Before(cur) {
				continue
			}
			if generatedMonths[monthKey{int(t.Month()), t.Year()}] {
				continue
			}
			for _, ri := range recItems {
				var amt float64
				if ri.Currency == "ARS" {
					if ri.AmountARS != nil {
						amt = *ri.AmountARS
					}
				} else {
					amt = ri.AmountUSD * latestRate
				}
				totals[i] += amt
			}
		}
	}

	return totals, nil
}

// ── GET /dashboards/card-spending ─────────────────────────────────────────────

type cardSpendingRow struct {
	CardID   int       `json:"card_id"`
	CardName string    `json:"card_name"`
	ColorHex string    `json:"color_hex"`
	Values   []float64 `json:"values"`
}

type cardSpendingResponse struct {
	Year       int               `json:"year"`
	Months     []int             `json:"months"`
	Total      []float64         `json:"total"`
	ByCard     []cardSpendingRow `json:"by_card"`
	HasPending []bool            `json:"has_pending"`
}

func GetCardSpending(w http.ResponseWriter, r *http.Request) {
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil || year == 0 {
		http.Error(w, "missing year", http.StatusBadRequest)
		return
	}

	// Active cards (ordered by name for stable output)
	type cardInfo struct {
		ID       int
		Name     string
		ColorHex string
	}
	var cards []cardInfo
	cardRows, err := db.Pool.Query(r.Context(),
		"SELECT id, name, COALESCE(color_hex,'') FROM cards WHERE active = true ORDER BY name")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer cardRows.Close()
	for cardRows.Next() {
		var c cardInfo
		cardRows.Scan(&c.ID, &c.Name, &c.ColorHex)
		cards = append(cards, c)
	}

	monthDates := make([]time.Time, 12)
	for i := 0; i < 12; i++ {
		monthDates[i] = time.Date(year, time.Month(i+1), 1, 0, 0, 0, 0, time.UTC)
	}

	// Per-card per-month totals
	cardMonthTotals := map[int][]float64{}
	for _, c := range cards {
		cardMonthTotals[c.ID] = make([]float64, 12)
	}
	grandTotal := make([]float64, 12)

	// Recurring merchant deduplication set
	recurringMerchantSet := map[string]bool{}
	rmRows, err := db.Pool.Query(r.Context(),
		"SELECT merchant FROM recurring_expenses WHERE active = true")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rmRows.Close()
	for rmRows.Next() {
		var m string
		rmRows.Scan(&m)
		recurringMerchantSet[normalizeMerchant(m)] = true
	}

	// All expenses
	startDate := time.Date(year-2, 1, 1, 0, 0, 0, 0, time.UTC)
	rows, err := db.Pool.Query(r.Context(),
		`SELECT purchase_date, total_amount, installments,
		        (recurring_id IS NOT NULL) AS is_recurring, merchant, card_id
		 FROM expenses WHERE purchase_date >= $1`, startDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var purchaseDate time.Time
		var totalAmount float64
		var installments, cardID int
		var isRecurring bool
		var merchant string
		if err := rows.Scan(&purchaseDate, &totalAmount, &installments, &isRecurring, &merchant, &cardID); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if installments < 1 {
			installments = 1
		}
		perInstallment := totalAmount / float64(installments)
		ct, hasCard := cardMonthTotals[cardID]

		if isRecurring {
			pdMonth, pdYear := int(purchaseDate.Month()), purchaseDate.Year()
			for i, t := range monthDates {
				if int(t.Month()) == pdMonth && t.Year() == pdYear {
					if hasCard {
						ct[i] += totalAmount
					}
					grandTotal[i] += totalAmount
					break
				}
			}
		} else {
			if recurringMerchantSet[normalizeMerchant(merchant)] {
				continue
			}
			firstImpact := getFirstImpactMonth(purchaseDate.Format("2006-01-02"))
			for inst := 0; inst < installments; inst++ {
				mo := int(firstImpact.Month()) + inst
				yr := firstImpact.Year()
				for mo > 12 {
					mo -= 12
					yr++
				}
				if yr == year {
					if idx := mo - 1; idx >= 0 && idx < 12 {
						if hasCard {
							ct[idx] += perInstallment
						}
						grandTotal[idx] += perInstallment
					}
				}
			}
		}
	}

	// Generated months tracking
	generatedMonths := map[monthKey]bool{}
	genRows, err := db.Pool.Query(r.Context(),
		`SELECT DISTINCT EXTRACT(MONTH FROM purchase_date)::int, EXTRACT(YEAR FROM purchase_date)::int
		 FROM expenses WHERE recurring_id IS NOT NULL`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer genRows.Close()
	for genRows.Next() {
		var m, y int
		genRows.Scan(&m, &y)
		generatedMonths[monthKey{m, y}] = true
	}

	// Active recurring items with card_id (for estimated months)
	type recItemWithCard struct {
		CardID    int
		AmountUSD float64
		AmountARS *float64
		Currency  string
	}
	var recItems []recItemWithCard
	recRows, err := db.Pool.Query(r.Context(),
		"SELECT card_id, amount_usd, amount_ars, currency FROM recurring_expenses WHERE active = true")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer recRows.Close()
	for recRows.Next() {
		var ri recItemWithCard
		recRows.Scan(&ri.CardID, &ri.AmountUSD, &ri.AmountARS, &ri.Currency)
		recItems = append(recItems, ri)
	}

	var latestRate float64
	db.Pool.QueryRow(r.Context(),
		"SELECT usd_to_ars FROM exchange_rate_history ORDER BY year DESC, month DESC LIMIT 1",
	).Scan(&latestRate)

	hasUSDRecurring := false
	for _, ri := range recItems {
		if ri.Currency == "USD" {
			hasUSDRecurring = true
			break
		}
	}
	rateOK := !hasUSDRecurring || latestRate > 0

	now := time.Now()
	cur := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	hasPending := make([]bool, 12)

	if len(recItems) > 0 && rateOK {
		for i, t := range monthDates {
			if t.Before(cur) {
				continue
			}
			if generatedMonths[monthKey{int(t.Month()), t.Year()}] {
				continue
			}
			for _, ri := range recItems {
				var amt float64
				if ri.Currency == "ARS" {
					if ri.AmountARS != nil {
						amt = *ri.AmountARS
					}
				} else {
					amt = ri.AmountUSD * latestRate
				}
				if amt > 0 {
					if ct, ok := cardMonthTotals[ri.CardID]; ok {
						ct[i] += amt
					}
					grandTotal[i] += amt
				}
			}
			hasPending[i] = hasUSDRecurring
		}
	}

	// Build response
	byCard := make([]cardSpendingRow, 0, len(cards))
	for _, c := range cards {
		byCard = append(byCard, cardSpendingRow{
			CardID:   c.ID,
			CardName: c.Name,
			ColorHex: c.ColorHex,
			Values:   cardMonthTotals[c.ID],
		})
	}

	months := make([]int, 12)
	for i := range months {
		months[i] = i + 1
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cardSpendingResponse{
		Year:       year,
		Months:     months,
		Total:      grandTotal,
		ByCard:     byCard,
		HasPending: hasPending,
	})
}

// ── GET /dashboards/cashflow ──────────────────────────────────────────────────

func GetCashflowDashboard(w http.ResponseWriter, r *http.Request) {
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil || year == 0 {
		http.Error(w, "missing year", http.StatusBadRequest)
		return
	}

	// Load category types, excluding savings categories from expenses
	catType := map[int]string{}
	catRows, err := db.Pool.Query(r.Context(),
		"SELECT id, type FROM cashflow_categories WHERE active = true AND name NOT ILIKE '%ahorros%'")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer catRows.Close()
	for catRows.Next() {
		var id int
		var t string
		catRows.Scan(&id, &t)
		catType[id] = t
	}

	income := make([]float64, 12)
	expenses := make([]float64, 12)

	entRows, err := db.Pool.Query(r.Context(),
		"SELECT category_id, month, amount FROM cashflow_entries WHERE year = $1", year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer entRows.Close()
	for entRows.Next() {
		var catID, month int
		var amount float64
		entRows.Scan(&catID, &month, &amount)
		if month < 1 || month > 12 {
			continue
		}
		switch catType[catID] {
		case "income":
			income[month-1] += amount
		case "expense":
			expenses[month-1] += amount
		}
	}

	// Add credit card spending to expenses
	cardTotals, err := computeMonthlyCardTotals(r.Context(), year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	for i, ct := range cardTotals {
		expenses[i] += ct
	}

	// Savings per month (excluded from expenses but needed for available and its own line)
	savings := make([]float64, 12)
	savRows, err := db.Pool.Query(r.Context(),
		`SELECT ce.month, SUM(ce.amount)
		 FROM cashflow_entries ce
		 JOIN cashflow_categories cc ON cc.id = ce.category_id
		 WHERE cc.name ILIKE '%ahorros%' AND cc.type = 'expense' AND ce.year = $1
		 GROUP BY ce.month`, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer savRows.Close()
	for savRows.Next() {
		var month int
		var amount float64
		savRows.Scan(&month, &amount)
		if month >= 1 && month <= 12 {
			savings[month-1] = amount
		}
	}

	available := make([]float64, 12)
	for i := range income {
		available[i] = income[i] - expenses[i] - savings[i]
	}

	months := make([]int, 12)
	for i := range months {
		months[i] = i + 1
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Year      int       `json:"year"`
		Months    []int     `json:"months"`
		Income    []float64 `json:"income"`
		Expenses  []float64 `json:"expenses"`
		Savings   []float64 `json:"savings"`
		Available []float64 `json:"available"`
	}{
		Year:      year,
		Months:    months,
		Income:    income,
		Expenses:  expenses,
		Savings:   savings,
		Available: available,
	})
}

// ── GET /dashboards/savings ───────────────────────────────────────────────────

func GetSavingsDashboard(w http.ResponseWriter, r *http.Request) {
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil || year == 0 {
		http.Error(w, "missing year", http.StatusBadRequest)
		return
	}

	values := make([]float64, 12)

	rows, err := db.Pool.Query(r.Context(),
		`SELECT ce.month, SUM(ce.amount)
		 FROM cashflow_entries ce
		 JOIN cashflow_categories cc ON cc.id = ce.category_id
		 WHERE cc.name ILIKE '%ahorros%' AND cc.type = 'expense' AND ce.year = $1
		 GROUP BY ce.month`, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var month int
		var amount float64
		rows.Scan(&month, &amount)
		if month >= 1 && month <= 12 {
			values[month-1] = amount
		}
	}

	months := make([]int, 12)
	for i := range months {
		months[i] = i + 1
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Year   int       `json:"year"`
		Months []int     `json:"months"`
		Values []float64 `json:"values"`
	}{
		Year:   year,
		Months: months,
		Values: values,
	})
}
