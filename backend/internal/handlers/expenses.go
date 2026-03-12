package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/db"
	"github.com/Ren14/gastos-tarjeta/internal/models"
	"github.com/go-chi/chi/v5"
)

func GetExpenses(w http.ResponseWriter, r *http.Request) {
	cardID := r.URL.Query().Get("card_id")

	query := `SELECT id, card_id, category_id, merchant, total_amount, installments,
		installment_amount, purchase_date, recurring_id, notes, color, created_at
		FROM expenses`
	args := []any{}

	if cardID != "" {
		query += " WHERE card_id = $1"
		args = append(args, cardID)
	}
	query += " ORDER BY created_at DESC"

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	expenses := []models.Expense{}
	for rows.Next() {
		var e models.Expense
		var purchaseDate time.Time // ← scanear como time.Time
		if err := rows.Scan(&e.ID, &e.CardID, &e.CategoryID, &e.Merchant,
			&e.TotalAmount, &e.Installments, &e.InstallmentAmount,
			&purchaseDate, &e.RecurringID, &e.Notes, &e.Color, &e.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		e.PurchaseDate = purchaseDate.Format("2006-01-02") // ← convertir a string
		expenses = append(expenses, e)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(expenses)
}

func CreateExpense(w http.ResponseWriter, r *http.Request) {
	var e models.Expense
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if e.Installments == 0 {
		e.Installments = 1
	}

	err := db.Pool.QueryRow(context.Background(),
		`INSERT INTO expenses (card_id, category_id, merchant, total_amount, installments, purchase_date, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, installment_amount, created_at`,
		e.CardID, e.CategoryID, e.Merchant, e.TotalAmount,
		e.Installments, e.PurchaseDate, e.Notes,
	).Scan(&e.ID, &e.InstallmentAmount, &e.CreatedAt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(e)
}

func DeleteExpense(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	_, err = db.Pool.Exec(context.Background(), "DELETE FROM expenses WHERE id = $1", id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func UpdateExpense(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var e models.Expense
	if err := json.NewDecoder(r.Body).Decode(&e); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if e.Installments == 0 {
		e.Installments = 1
	}

	_, err = db.Pool.Exec(context.Background(),
		`UPDATE expenses SET card_id=$1, category_id=$2, merchant=$3,
		total_amount=$4, installments=$5, purchase_date=$6, notes=$7, color=$8
		WHERE id=$9`,
		e.CardID, e.CategoryID, e.Merchant,
		e.TotalAmount, e.Installments, e.PurchaseDate, e.Notes, e.Color, id,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
