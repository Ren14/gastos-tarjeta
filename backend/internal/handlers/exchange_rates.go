package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Ren14/gastos-tarjeta/internal/db"
	"github.com/Ren14/gastos-tarjeta/internal/models"
	"github.com/go-chi/chi/v5"
)

func GetExchangeRates(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(context.Background(),
		"SELECT id, month, year, usd_to_ars, COALESCE(notes,''), created_at FROM exchange_rate_history ORDER BY year DESC, month DESC")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	rates := []models.ExchangeRate{}
	for rows.Next() {
		var r models.ExchangeRate
		rows.Scan(&r.ID, &r.Month, &r.Year, &r.UsdToArs, &r.Notes, &r.CreatedAt)
		rates = append(rates, r)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rates)
}

func CreateExchangeRate(w http.ResponseWriter, r *http.Request) {
	var rate models.ExchangeRate
	if err := json.NewDecoder(r.Body).Decode(&rate); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err := db.Pool.QueryRow(context.Background(),
		`INSERT INTO exchange_rate_history (month, year, usd_to_ars, notes)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (month, year) DO UPDATE SET usd_to_ars = $3, notes = $4
		RETURNING id, created_at`,
		rate.Month, rate.Year, rate.UsdToArs, rate.Notes,
	).Scan(&rate.ID, &rate.CreatedAt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(rate)
}

func GetClosestExchangeRate(w http.ResponseWriter, r *http.Request) {
	month, _ := strconv.Atoi(r.URL.Query().Get("month"))
	year, _ := strconv.Atoi(r.URL.Query().Get("year"))

	if month == 0 || year == 0 {
		http.Error(w, "month and year are required", http.StatusBadRequest)
		return
	}

	var rate models.ExchangeRate
	// Most recent rate on or before the given month/year
	err := db.Pool.QueryRow(context.Background(),
		`SELECT id, month, year, usd_to_ars, COALESCE(notes,''), created_at
		FROM exchange_rate_history
		WHERE year < $2 OR (year = $2 AND month <= $1)
		ORDER BY year DESC, month DESC LIMIT 1`,
		month, year,
	).Scan(&rate.ID, &rate.Month, &rate.Year, &rate.UsdToArs, &rate.Notes, &rate.CreatedAt)

	if err != nil {
		// Fallback: oldest available rate
		err = db.Pool.QueryRow(context.Background(),
			`SELECT id, month, year, usd_to_ars, COALESCE(notes,''), created_at
			FROM exchange_rate_history ORDER BY year ASC, month ASC LIMIT 1`,
		).Scan(&rate.ID, &rate.Month, &rate.Year, &rate.UsdToArs, &rate.Notes, &rate.CreatedAt)
		if err != nil {
			http.Error(w, "no exchange rates found", http.StatusNotFound)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rate)
}

func UpdateExchangeRate(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var rate models.ExchangeRate
	if err := json.NewDecoder(r.Body).Decode(&rate); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err = db.Pool.Exec(context.Background(),
		"UPDATE exchange_rate_history SET usd_to_ars=$1, notes=$2 WHERE id=$3",
		rate.UsdToArs, rate.Notes, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
