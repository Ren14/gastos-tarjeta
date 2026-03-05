package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/db"
	"github.com/Ren14/gastos-tarjeta/internal/models"
)

func GetRecurring(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, card_id, category_id, merchant, amount_usd, active, created_at
		FROM recurring_expenses WHERE active = true ORDER BY merchant`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []models.RecurringExpense{}
	for rows.Next() {
		var re models.RecurringExpense
		rows.Scan(&re.ID, &re.CardID, &re.CategoryID, &re.Merchant,
			&re.AmountUSD, &re.Active, &re.CreatedAt)
		items = append(items, re)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func GenerateRecurring(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Month int `json:"month"`
		Year  int `json:"year"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Verificar que existe cotización para ese mes
	var rate float64
	err := db.Pool.QueryRow(context.Background(),
		"SELECT usd_to_ars FROM exchange_rate_history WHERE month=$1 AND year=$2",
		body.Month, body.Year,
	).Scan(&rate)
	if err != nil {
		http.Error(w, `{"error":"exchange_rate_missing","message":"Cargá la cotización del mes antes de generar recurrentes"}`, http.StatusPaymentRequired)
		return
	}

	// Verificar que no fueron generados ya
	var count int
	db.Pool.QueryRow(context.Background(),
		"SELECT COUNT(*) FROM expenses WHERE recurring_id IS NOT NULL AND EXTRACT(MONTH FROM purchase_date)=$1 AND EXTRACT(YEAR FROM purchase_date)=$2",
		body.Month, body.Year,
	).Scan(&count)

	if count > 0 {
		http.Error(w, `{"error":"already_generated","message":"Los recurrentes de este mes ya fueron generados"}`, http.StatusConflict)
		return
	}

	// Traer recurrentes activos
	rows, err := db.Pool.Query(context.Background(),
		"SELECT id, card_id, category_id, merchant, amount_usd FROM recurring_expenses WHERE active = true")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	purchaseDate := time.Date(body.Year, time.Month(body.Month), 1, 0, 0, 0, 0, time.UTC)
	generated := 0

	for rows.Next() {
		var id, cardID int
		var categoryID *int
		var merchant string
		var amountUSD float64
		rows.Scan(&id, &cardID, &categoryID, &merchant, &amountUSD)

		amountARS := amountUSD * rate

		_, err := db.Pool.Exec(context.Background(),
			`INSERT INTO expenses (card_id, category_id, merchant, total_amount, installments, purchase_date, recurring_id)
			VALUES ($1, $2, $3, $4, 1, $5, $6)`,
			cardID, categoryID, merchant, amountARS, purchaseDate, id,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		generated++
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]int{"generated": generated})
}
