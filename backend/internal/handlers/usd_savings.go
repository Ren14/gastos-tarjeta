package handlers

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Ren14/gastos-tarjeta/internal/db"
)

// ── In-memory exchange rate cache (1-hour TTL) ─────────────────────────────

var (
	cachedDolarRate float64
	cacheExpiry     time.Time
	cacheMu         sync.Mutex
)

type dolarAPIResponse struct {
	Venta float64 `json:"venta"`
}

func fetchDolarRate() (float64, error) {
	cacheMu.Lock()
	defer cacheMu.Unlock()

	if cachedDolarRate > 0 && time.Now().Before(cacheExpiry) {
		return cachedDolarRate, nil
	}

	resp, err := http.Get("https://dolarapi.com/v1/dolares/blue") //nolint
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, err
	}

	var result dolarAPIResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return 0, err
	}

	cachedDolarRate = result.Venta
	cacheExpiry = time.Now().Add(time.Hour)
	return cachedDolarRate, nil
}

// ── Handlers ───────────────────────────────────────────────────────────────

type UsdSavingRow struct {
	ID          int     `json:"id"`
	Donde       string  `json:"donde"`
	Cuanto      float64 `json:"cuanto"`
	Instrumento string  `json:"instrumento"`
}

func GetUsdSavings(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(r.Context(),
		`SELECT id, donde, cuanto, instrumento FROM usd_savings ORDER BY id`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	result := []UsdSavingRow{}
	for rows.Next() {
		var s UsdSavingRow
		rows.Scan(&s.ID, &s.Donde, &s.Cuanto, &s.Instrumento)
		result = append(result, s)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func CreateUsdSaving(w http.ResponseWriter, r *http.Request) {
	var req UsdSavingRow
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var s UsdSavingRow
	err := db.Pool.QueryRow(r.Context(),
		`INSERT INTO usd_savings (donde, cuanto, instrumento) VALUES ($1, $2, $3)
		 RETURNING id, donde, cuanto, instrumento`,
		req.Donde, req.Cuanto, req.Instrumento,
	).Scan(&s.ID, &s.Donde, &s.Cuanto, &s.Instrumento)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(s)
}

func UpdateUsdSaving(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req UsdSavingRow
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var s UsdSavingRow
	err = db.Pool.QueryRow(r.Context(),
		`UPDATE usd_savings SET donde=$1, cuanto=$2, instrumento=$3
		 WHERE id=$4 RETURNING id, donde, cuanto, instrumento`,
		req.Donde, req.Cuanto, req.Instrumento, id,
	).Scan(&s.ID, &s.Donde, &s.Cuanto, &s.Instrumento)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

func DeleteUsdSaving(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	_, err = db.Pool.Exec(r.Context(), `DELETE FROM usd_savings WHERE id=$1`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func GetDolarRate(w http.ResponseWriter, r *http.Request) {
	rate, err := fetchDolarRate()
	if err != nil {
		http.Error(w, `{"error":"no se pudo obtener la cotización"}`, http.StatusBadGateway)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]float64{"venta": rate})
}
