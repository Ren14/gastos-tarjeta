package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/db"
	"github.com/Ren14/gastos-tarjeta/internal/models"
)

func getFirstImpactMonth(purchaseDateStr string) time.Time {
	purchaseDate, _ := time.Parse("2006-01-02", purchaseDateStr)
	lastDay := time.Date(purchaseDate.Year(), purchaseDate.Month()+1, 0, 0, 0, 0, 0, purchaseDate.Location())
	daysFromEnd := lastDay.Day() - purchaseDate.Day()
	if daysFromEnd < 2 {
		return time.Date(purchaseDate.Year(), purchaseDate.Month()+2, 1, 0, 0, 0, 0, purchaseDate.Location())
	}
	return time.Date(purchaseDate.Year(), purchaseDate.Month()+1, 1, 0, 0, 0, 0, purchaseDate.Location())
}

func monthsBetween(a, b time.Time) int {
	months := (b.Year()-a.Year())*12 + int(b.Month()-a.Month())
	return months
}

func GetMonthlySummary(w http.ResponseWriter, r *http.Request) {
	monthStr := r.URL.Query().Get("month")
	yearStr := r.URL.Query().Get("year")
	cardIDStr := r.URL.Query().Get("card_id")

	month, _ := strconv.Atoi(monthStr)
	year, _ := strconv.Atoi(yearStr)

	if month == 0 || year == 0 {
		http.Error(w, "month and year are required", http.StatusBadRequest)
		return
	}

	targetMonth := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)

	query := `SELECT e.id, e.merchant, e.total_amount, e.installments,
		e.purchase_date, e.card_id, c.name, e.category_id, e.recurring_id
		FROM expenses e
		JOIN cards c ON c.id = e.card_id
		WHERE c.active = true`
	args := []any{}

	if cardIDStr != "" {
		args = append(args, cardIDStr)
		query += " AND e.card_id = $" + strconv.Itoa(len(args))
	}

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []models.MonthlyExpenseItem{}
	total := 0.0

	for rows.Next() {
		var expID, cardID, installments int
		var merchant, cardName string
		var totalAmount float64
		var purchaseDate time.Time
		var categoryID, recurringID *int

		if err := rows.Scan(&expID, &merchant, &totalAmount, &installments,
			&purchaseDate, &cardID, &cardName, &categoryID, &recurringID); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		firstImpact := getFirstImpactMonth(purchaseDate.Format("2006-01-02"))
		lastImpact := time.Date(firstImpact.Year(), firstImpact.Month()+time.Month(installments)-1, 1, 0, 0, 0, 0, time.UTC)

		if targetMonth.Before(firstImpact) || targetMonth.After(lastImpact) {
			continue
		}

		installmentNumber := monthsBetween(firstImpact, targetMonth) + 1
		installmentAmount := totalAmount / float64(installments)

		items = append(items, models.MonthlyExpenseItem{
			ExpenseID:         expID,
			Merchant:          merchant,
			InstallmentAmount: installmentAmount,
			InstallmentNumber: installmentNumber,
			TotalInstallments: installments,
			CardID:            cardID,
			CardName:          cardName,
			CategoryID:        categoryID,
			IsRecurring:       recurringID != nil,
			RecurringID:       recurringID,
			PurchaseDate:      purchaseDate.Format("2006-01-02"),
			TotalAmount:       totalAmount,
		})
		total += installmentAmount
	}

	summary := models.MonthlySummary{
		Month:    month,
		Year:     year,
		Total:    total,
		Expenses: items,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(summary)
}

func GetSummaryByCard(w http.ResponseWriter, r *http.Request) {
	monthStr := r.URL.Query().Get("month")
	yearStr := r.URL.Query().Get("year")

	month, _ := strconv.Atoi(monthStr)
	year, _ := strconv.Atoi(yearStr)

	if month == 0 || year == 0 {
		http.Error(w, "month and year are required", http.StatusBadRequest)
		return
	}

	// Traemos todas las tarjetas activas
	cardRows, err := db.Pool.Query(context.Background(),
		"SELECT id, name, COALESCE(color_hex,'') FROM cards WHERE active = true ORDER BY name")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer cardRows.Close()

	cardTotals := map[int]*models.CardSummary{}
	cardOrder := []int{}
	for cardRows.Next() {
		var cs models.CardSummary
		cardRows.Scan(&cs.CardID, &cs.CardName, &cs.ColorHex)
		cardTotals[cs.CardID] = &cs
		cardOrder = append(cardOrder, cs.CardID)
	}

	// Reutilizamos la lógica de monthly para calcular totales por tarjeta
	targetMonth := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)

	rows, err := db.Pool.Query(context.Background(),
		"SELECT e.total_amount, e.installments, e.purchase_date, e.card_id FROM expenses e JOIN cards c ON c.id = e.card_id WHERE c.active = true")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var totalAmount float64
		var installments, cardID int
		var purchaseDate time.Time
		rows.Scan(&totalAmount, &installments, &purchaseDate, &cardID)

		firstImpact := getFirstImpactMonth(purchaseDate.Format("2006-01-02"))
		lastImpact := time.Date(firstImpact.Year(), firstImpact.Month()+time.Month(installments)-1, 1, 0, 0, 0, 0, time.UTC)

		if targetMonth.Before(firstImpact) || targetMonth.After(lastImpact) {
			continue
		}

		if cs, ok := cardTotals[cardID]; ok {
			cs.Total += totalAmount / float64(installments)
		}
	}

	result := []models.CardSummary{}
	for _, id := range cardOrder {
		result = append(result, *cardTotals[id])
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func GetProjection(w http.ResponseWriter, r *http.Request) {
	monthsStr := r.URL.Query().Get("months")
	months, err := strconv.Atoi(monthsStr)
	if err != nil || months == 0 {
		months = 6
	}

	// Traemos todas las tarjetas activas
	cardRows, err := db.Pool.Query(context.Background(),
		"SELECT id, name, COALESCE(color_hex,'') FROM cards WHERE active = true ORDER BY name")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer cardRows.Close()

	type CardInfo struct {
		ID       int
		Name     string
		ColorHex string
	}
	cardMap := map[int]CardInfo{}
	for cardRows.Next() {
		var c CardInfo
		cardRows.Scan(&c.ID, &c.Name, &c.ColorHex)
		cardMap[c.ID] = c
	}

	// Meses en los que ya se generaron recurrentes
	type MonthKey struct{ Month, Year int }
	generatedMonths := map[MonthKey]bool{}
	genRows, err := db.Pool.Query(context.Background(),
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
		generatedMonths[MonthKey{m, y}] = true
	}

	// Recurrentes activos
	type RecurringItem struct {
		CardID    int
		AmountUSD float64
	}
	recurringItems := []RecurringItem{}
	recRows, err := db.Pool.Query(context.Background(),
		"SELECT card_id, amount_usd FROM recurring_expenses WHERE active = true")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer recRows.Close()
	for recRows.Next() {
		var ri RecurringItem
		recRows.Scan(&ri.CardID, &ri.AmountUSD)
		recurringItems = append(recurringItems, ri)
	}

	// Cotización más reciente disponible como fallback
	var latestRate float64
	db.Pool.QueryRow(context.Background(),
		"SELECT usd_to_ars FROM exchange_rate_history ORDER BY year DESC, month DESC LIMIT 1",
	).Scan(&latestRate)

	// Traemos todos los gastos; distinguimos recurrentes de regulares
	rows, err := db.Pool.Query(context.Background(),
		"SELECT total_amount, installments, purchase_date, card_id, recurring_id IS NOT NULL FROM expenses")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// Estructura: mes -> card_id -> total
	type MonthData struct {
		Month               int                  `json:"month"`
		Year                int                  `json:"year"`
		Total               float64              `json:"total"`
		ByCard              []models.CardSummary `json:"by_card"`
		HasData             bool                 `json:"has_data"`
		HasPendingRecurring bool                 `json:"has_pending_recurring"`
		RecurringTotal      float64              `json:"recurring_total"`
	}

	now := time.Now()
	startMonth, _ := strconv.Atoi(r.URL.Query().Get("start_month"))
	startYear, _ := strconv.Atoi(r.URL.Query().Get("start_year"))
	var origin time.Time
	if startMonth > 0 && startYear > 0 {
		origin = time.Date(startYear, time.Month(startMonth), 1, 0, 0, 0, 0, time.UTC)
	} else {
		origin = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	}

	// Inicializamos los N meses a partir de origin
	monthTotals := make([]map[int]float64, months)
	monthDates := make([]time.Time, months)
	for i := 0; i < months; i++ {
		monthDates[i] = time.Date(origin.Year(), origin.Month()+time.Month(i), 1, 0, 0, 0, 0, time.UTC)
		monthTotals[i] = map[int]float64{}
	}

	for rows.Next() {
		var totalAmount float64
		var installments, cardID int
		var purchaseDate time.Time
		var isRecurring bool
		rows.Scan(&totalAmount, &installments, &purchaseDate, &cardID, &isRecurring)

		if isRecurring {
			// Generated recurring expenses impact exactly the month of their purchase_date.
			// Do NOT run them through getFirstImpactMonth — that would shift them one month forward.
			pdMonth := int(purchaseDate.Month())
			pdYear := purchaseDate.Year()
			for i, targetMonth := range monthDates {
				if int(targetMonth.Month()) == pdMonth && targetMonth.Year() == pdYear {
					monthTotals[i][cardID] += totalAmount
					break
				}
			}
		} else {
			firstImpact := getFirstImpactMonth(purchaseDate.Format("2006-01-02"))
			for i, targetMonth := range monthDates {
				lastImpact := time.Date(firstImpact.Year(), firstImpact.Month()+time.Month(installments)-1, 1, 0, 0, 0, 0, time.UTC)
				if targetMonth.Before(firstImpact) || targetMonth.After(lastImpact) {
					continue
				}
				monthTotals[i][cardID] += totalAmount / float64(installments)
			}
		}
	}

	// Stable card order for consistent rendering
	cardOrder := make([]CardInfo, 0, len(cardMap))
	for _, info := range cardMap {
		cardOrder = append(cardOrder, info)
	}
	sort.Slice(cardOrder, func(i, j int) bool {
		return cardOrder[i].Name < cardOrder[j].Name
	})

	currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	result := []MonthData{}
	for i, targetMonth := range monthDates {
		key := MonthKey{int(targetMonth.Month()), targetMonth.Year()}
		isPast := targetMonth.Before(currentMonthStart)
		hasPending := len(recurringItems) > 0 && !generatedMonths[key] && latestRate > 0 && !isPast
		recurringTotal := 0.0

		// Sumamos estimación de recurrentes si aún no fueron generados
		if hasPending {
			for _, ri := range recurringItems {
				if _, ok := cardMap[ri.CardID]; ok {
					amt := ri.AmountUSD * latestRate
					monthTotals[i][ri.CardID] += amt
					recurringTotal += amt
				}
			}
		}

		byCard := []models.CardSummary{}
		total := 0.0
		hasData := false

		for _, info := range cardOrder {
			cardTotal := monthTotals[i][info.ID]
			byCard = append(byCard, models.CardSummary{
				CardID:   info.ID,
				CardName: info.Name,
				ColorHex: info.ColorHex,
				Total:    cardTotal,
			})
			total += cardTotal
			if cardTotal > 0 {
				hasData = true
			}
		}

		result = append(result, MonthData{
			Month:               int(targetMonth.Month()),
			Year:                targetMonth.Year(),
			Total:               total,
			ByCard:              byCard,
			HasData:             hasData,
			HasPendingRecurring: hasPending,
			RecurringTotal:      recurringTotal,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
