package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Ren14/gastos-tarjeta/internal/db"
	"github.com/go-chi/chi/v5"
)

type Clasificacion struct {
	ID        int    `json:"id"`
	Name      string `json:"name"`
	SortOrder int    `json:"sort_order"`
}

func GetClasificaciones(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(r.Context(),
		"SELECT id, name, sort_order FROM flujo_clasificaciones ORDER BY sort_order, name")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	result := []Clasificacion{}
	for rows.Next() {
		var c Clasificacion
		if err := rows.Scan(&c.ID, &c.Name, &c.SortOrder); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		result = append(result, c)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func CreateClasificacion(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name      string `json:"name"`
		SortOrder int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var c Clasificacion
	err := db.Pool.QueryRow(r.Context(),
		"INSERT INTO flujo_clasificaciones (name, sort_order) VALUES ($1, $2) RETURNING id, name, sort_order",
		req.Name, req.SortOrder,
	).Scan(&c.ID, &c.Name, &c.SortOrder)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(c)
}

func UpdateClasificacion(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		Name      string `json:"name"`
		SortOrder int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var c Clasificacion
	err = db.Pool.QueryRow(r.Context(),
		"UPDATE flujo_clasificaciones SET name=$1, sort_order=$2 WHERE id=$3 RETURNING id, name, sort_order",
		req.Name, req.SortOrder, id,
	).Scan(&c.ID, &c.Name, &c.SortOrder)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(c)
}

func UpdateCategoryClasificacion(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	var req struct {
		ClasificacionID int `json:"clasificacion_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	_, err = db.Pool.Exec(r.Context(),
		"UPDATE cashflow_categories SET clasificacion_id=$1 WHERE id=$2",
		req.ClasificacionID, id,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
