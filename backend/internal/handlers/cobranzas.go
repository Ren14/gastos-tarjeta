package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Ren14/gastos-tarjeta/internal/db"
)

var excludedClasifNames = map[string]bool{
	"Renzo":  true,
	"Casa":   true,
	"Ahorros": true,
	"Deporte": true,
	"Salud":  true,
	"Varios": true,
}

func GetCobranzas(w http.ResponseWriter, r *http.Request) {
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil || year == 0 {
		http.Error(w, "missing year", http.StatusBadRequest)
		return
	}

	// Load all cashflow categories with their clasificacion
	type catRow struct {
		CategoryID      int
		CategoryName    string
		Type            string
		ClasifID        *int
		ClasifName      string
	}
	rows, err := db.Pool.Query(r.Context(),
		`SELECT c.id, c.name, c.type, c.clasificacion_id, COALESCE(cl.name, '')
		 FROM cashflow_categories c
		 LEFT JOIN flujo_clasificaciones cl ON cl.id = c.clasificacion_id
		 WHERE c.active = true
		 ORDER BY cl.sort_order, c.sort_order, c.name`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var cats []catRow
	for rows.Next() {
		var c catRow
		if err := rows.Scan(&c.CategoryID, &c.CategoryName, &c.Type, &c.ClasifID, &c.ClasifName); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		cats = append(cats, c)
	}
	rows.Close()

	// Load entries for the year
	entryRows, err := db.Pool.Query(r.Context(),
		`SELECT category_id, month, amount FROM cashflow_entries WHERE year = $1`, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer entryRows.Close()

	// entryMap[category_id][month] = amount
	entryMap := map[int]map[int]float64{}
	for entryRows.Next() {
		var catID, month int
		var amount float64
		if err := entryRows.Scan(&catID, &month, &amount); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if entryMap[catID] == nil {
			entryMap[catID] = map[int]float64{}
		}
		entryMap[catID][month] = amount
	}

	// Group by classification, excluding unwanted ones
	type CategoryResult struct {
		CategoryID     int       `json:"category_id"`
		CategoryName   string    `json:"category_name"`
		Type           string    `json:"type"`
		MonthlyAmounts []float64 `json:"monthly_amounts"`
	}
	type GroupResult struct {
		ClasifID      int              `json:"clasificacion_id"`
		ClasifName    string           `json:"clasificacion_name"`
		Categories    []CategoryResult `json:"categories"`
		MonthlyTotals []float64        `json:"monthly_totals"`
	}

	// Preserve order using a slice + map
	groupOrder := []int{} // clasif IDs in order
	groups := map[int]*GroupResult{}

	for _, cat := range cats {
		if cat.ClasifID == nil {
			continue
		}
		if excludedClasifNames[cat.ClasifName] {
			continue
		}

		cid := *cat.ClasifID
		if _, exists := groups[cid]; !exists {
			groupOrder = append(groupOrder, cid)
			groups[cid] = &GroupResult{
				ClasifID:      cid,
				ClasifName:    cat.ClasifName,
				Categories:    []CategoryResult{},
				MonthlyTotals: make([]float64, 12),
			}
		}

		monthly := make([]float64, 12)
		for m := 1; m <= 12; m++ {
			amt := entryMap[cat.CategoryID][m]
			monthly[m-1] = amt
			groups[cid].MonthlyTotals[m-1] += amt
		}

		groups[cid].Categories = append(groups[cid].Categories, CategoryResult{
			CategoryID:     cat.CategoryID,
			CategoryName:   cat.CategoryName,
			Type:           cat.Type,
			MonthlyAmounts: monthly,
		})
	}

	result := make([]GroupResult, 0, len(groupOrder))
	for _, id := range groupOrder {
		result = append(result, *groups[id])
	}

	type Response struct {
		Year   int           `json:"year"`
		Groups []GroupResult `json:"groups"`
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{Year: year, Groups: result})
}
