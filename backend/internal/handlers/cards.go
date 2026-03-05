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

func GetCards(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(context.Background(),
		"SELECT id, name, COALESCE(bank,''), COALESCE(card_type,''), COALESCE(color_hex,''), active, created_at FROM cards WHERE active = true ORDER BY name")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	cards := []models.Card{}
	for rows.Next() {
		var c models.Card
		err := rows.Scan(&c.ID, &c.Name, &c.Bank, &c.CardType, &c.ColorHex, &c.Active, &c.CreatedAt)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		cards = append(cards, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cards)
}

func CreateCard(w http.ResponseWriter, r *http.Request) {
	var c models.Card
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	err := db.Pool.QueryRow(context.Background(),
		"INSERT INTO cards (name, bank, card_type, color_hex) VALUES ($1, $2, $3, $4) RETURNING id, created_at",
		c.Name, c.Bank, c.CardType, c.ColorHex,
	).Scan(&c.ID, &c.CreatedAt)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	c.Active = true
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

func UpdateCard(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var c models.Card
	if err := json.NewDecoder(r.Body).Decode(&c); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err = db.Pool.Exec(context.Background(),
		"UPDATE cards SET name=$1, bank=$2, card_type=$3, color_hex=$4, active=$5 WHERE id=$6",
		c.Name, c.Bank, c.CardType, c.ColorHex, c.Active, id,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
