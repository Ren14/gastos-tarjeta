package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Ren14/gastos-tarjeta/internal/db"
	"github.com/go-chi/chi/v5"
)

// ── List splits ──────────────────────────────────────────────────────────────

func GetSplits(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Pool.Query(context.Background(), `
		SELECT s.id, s.name, s.recurring_id,
		       re.merchant AS recurring_name, re.amount_usd, re.amount_ars, re.currency,
		       COUNT(sp.id) AS participant_count
		FROM splits s
		JOIN recurring_expenses re ON re.id = s.recurring_id
		LEFT JOIN split_participants sp ON sp.split_id = s.id
		GROUP BY s.id, s.name, s.recurring_id, re.merchant, re.amount_usd, re.amount_ars, re.currency
		ORDER BY s.id`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type splitRow struct {
		ID               int      `json:"id"`
		Name             string   `json:"name"`
		RecurringID      int      `json:"recurring_id"`
		RecurringName    string   `json:"recurring_name"`
		AmountUSD        float64  `json:"amount_usd"`
		AmountARS        *float64 `json:"amount_ars"`
		Currency         string   `json:"currency"`
		ParticipantCount int      `json:"participant_count"`
	}
	result := []splitRow{}
	for rows.Next() {
		var sr splitRow
		if err := rows.Scan(&sr.ID, &sr.Name, &sr.RecurringID,
			&sr.RecurringName, &sr.AmountUSD, &sr.AmountARS, &sr.Currency,
			&sr.ParticipantCount); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		result = append(result, sr)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ── Create split ─────────────────────────────────────────────────────────────

func CreateSplit(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RecurringID      int      `json:"recurring_id"`
		Name             string   `json:"name"`
		ParticipantNames []string `json:"participant_names"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if body.RecurringID == 0 || body.Name == "" || len(body.ParticipantNames) < 2 {
		http.Error(w, "recurring_id, name and at least 2 participant_names required", http.StatusBadRequest)
		return
	}

	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	var splitID int
	if err := tx.QueryRow(context.Background(),
		`INSERT INTO splits (recurring_id, name) VALUES ($1, $2) RETURNING id`,
		body.RecurringID, body.Name,
	).Scan(&splitID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	for i, name := range body.ParticipantNames {
		if _, err := tx.Exec(context.Background(),
			`INSERT INTO split_participants (split_id, name, sort_order) VALUES ($1, $2, $3)`,
			splitID, name, i); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]int{"id": splitID})
}

// ── Get split ─────────────────────────────────────────────────────────────────

func GetSplit(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	type splitDetail struct {
		ID            int      `json:"id"`
		Name          string   `json:"name"`
		RecurringID   int      `json:"recurring_id"`
		RecurringName string   `json:"recurring_name"`
		AmountUSD     float64  `json:"amount_usd"`
		AmountARS     *float64 `json:"amount_ars"`
		Currency      string   `json:"currency"`
	}
	var s splitDetail
	if err := db.Pool.QueryRow(context.Background(), `
		SELECT s.id, s.name, s.recurring_id,
		       re.merchant, re.amount_usd, re.amount_ars, re.currency
		FROM splits s JOIN recurring_expenses re ON re.id = s.recurring_id
		WHERE s.id = $1`, id,
	).Scan(&s.ID, &s.Name, &s.RecurringID, &s.RecurringName,
		&s.AmountUSD, &s.AmountARS, &s.Currency); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(s)
}

// ── Update split ─────────────────────────────────────────────────────────────

func UpdateSplit(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if _, err := db.Pool.Exec(context.Background(),
		`UPDATE splits SET name=$1 WHERE id=$2`, body.Name, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Delete split ─────────────────────────────────────────────────────────────

func DeleteSplit(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if _, err := db.Pool.Exec(context.Background(),
		`DELETE FROM splits WHERE id=$1`, id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Participants ──────────────────────────────────────────────────────────────

func GetSplitParticipants(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	rows, err := db.Pool.Query(context.Background(),
		`SELECT id, split_id, name, sort_order FROM split_participants
		WHERE split_id=$1 ORDER BY sort_order, id`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type participant struct {
		ID        int    `json:"id"`
		SplitID   int    `json:"split_id"`
		Name      string `json:"name"`
		SortOrder int    `json:"sort_order"`
	}
	result := []participant{}
	for rows.Next() {
		var p participant
		if err := rows.Scan(&p.ID, &p.SplitID, &p.Name, &p.SortOrder); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		result = append(result, p)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func AddSplitParticipant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Name      string `json:"name"`
		SortOrder int    `json:"sort_order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var pid int
	if err := db.Pool.QueryRow(context.Background(),
		`INSERT INTO split_participants (split_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id`,
		id, body.Name, body.SortOrder,
	).Scan(&pid); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]int{"id": pid})
}

func UpdateSplitParticipant(w http.ResponseWriter, r *http.Request) {
	pid := chi.URLParam(r, "pid")
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if _, err := db.Pool.Exec(context.Background(),
		`UPDATE split_participants SET name=$1 WHERE id=$2`, body.Name, pid); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func RemoveSplitParticipant(w http.ResponseWriter, r *http.Request) {
	pid := chi.URLParam(r, "pid")
	if _, err := db.Pool.Exec(context.Background(),
		`DELETE FROM split_participants WHERE id=$1`, pid); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Entry (color) ─────────────────────────────────────────────────────────────

func SaveSplitEntry(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		ParticipantID int    `json:"participant_id"`
		Month         int    `json:"month"`
		Year          int    `json:"year"`
		Color         string `json:"color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var colorVal *string
	if body.Color != "" {
		colorVal = &body.Color
	}
	if _, err := db.Pool.Exec(context.Background(), `
		INSERT INTO split_entries (split_id, participant_id, month, year, color)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (split_id, participant_id, month, year)
		DO UPDATE SET color = EXCLUDED.color`,
		id, body.ParticipantID, body.Month, body.Year, colorVal,
	); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ── Matrix ────────────────────────────────────────────────────────────────────

func GetSplitMatrix(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	yearStr := r.URL.Query().Get("year")
	year, err := strconv.Atoi(yearStr)
	if err != nil || year == 0 {
		http.Error(w, "year required", http.StatusBadRequest)
		return
	}

	// Load split + recurring info
	type splitInfo struct {
		ID            int
		Name          string
		RecurringID   int
		RecurringName string
		AmountUSD     float64
		AmountARS     *float64
		Currency      string
	}
	var s splitInfo
	if err := db.Pool.QueryRow(context.Background(), `
		SELECT s.id, s.name, s.recurring_id,
		       re.merchant, re.amount_usd, re.amount_ars, re.currency
		FROM splits s JOIN recurring_expenses re ON re.id = s.recurring_id
		WHERE s.id = $1`, id,
	).Scan(&s.ID, &s.Name, &s.RecurringID, &s.RecurringName,
		&s.AmountUSD, &s.AmountARS, &s.Currency); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Load participants
	type participant struct {
		ID        int    `json:"id"`
		Name      string `json:"name"`
		SortOrder int    `json:"sort_order"`
	}
	pRows, err := db.Pool.Query(context.Background(),
		`SELECT id, name, sort_order FROM split_participants
		WHERE split_id=$1 ORDER BY sort_order, id`, id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer pRows.Close()
	participants := []participant{}
	for pRows.Next() {
		var p participant
		if err := pRows.Scan(&p.ID, &p.Name, &p.SortOrder); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		participants = append(participants, p)
	}
	pRows.Close()

	participantCount := len(participants)

	// Load all exchange rates for the year (and nearby years for fallback)
	type rateRow struct {
		Month int
		Year  int
		Rate  float64
	}
	rateRows, err := db.Pool.Query(context.Background(),
		`SELECT month, year, usd_to_ars FROM exchange_rate_history
		ORDER BY year, month`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rateRows.Close()
	var allRates []rateRow
	for rateRows.Next() {
		var rr rateRow
		if err := rateRows.Scan(&rr.Month, &rr.Year, &rr.Rate); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		allRates = append(allRates, rr)
	}
	rateRows.Close()

	// Build rate lookup map
	rateMap := make(map[int]float64) // key = year*100+month
	for _, rr := range allRates {
		rateMap[rr.Year*100+rr.Month] = rr.Rate
	}

	// Closest rate fallback: find nearest rate by absolute distance in months
	getRate := func(month, yr int) (rate float64, estimated bool) {
		key := yr*100 + month
		if r, ok := rateMap[key]; ok {
			return r, false
		}
		// find closest by month distance
		targetMonths := yr*12 + month
		bestDist := 1<<31 - 1
		bestRate := 0.0
		for _, rr := range allRates {
			dist := rr.Year*12 + rr.Month - targetMonths
			if dist < 0 {
				dist = -dist
			}
			if dist < bestDist {
				bestDist = dist
				bestRate = rr.Rate
			}
		}
		return bestRate, true
	}

	// Load entries for this split+year
	type entryKey struct{ pid, month int }
	entryMap := make(map[entryKey]string)
	eRows, err := db.Pool.Query(context.Background(),
		`SELECT participant_id, month, color FROM split_entries
		WHERE split_id=$1 AND year=$2`, id, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer eRows.Close()
	for eRows.Next() {
		var pid, month int
		var color *string
		if err := eRows.Scan(&pid, &month, &color); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		c := ""
		if color != nil {
			c = *color
		}
		entryMap[entryKey{pid, month}] = c
	}
	eRows.Close()

	// Build months array
	type entryOut struct {
		ParticipantID int    `json:"participant_id"`
		Color         string `json:"color"`
	}
	type monthOut struct {
		Month       int        `json:"month"`
		Year        int        `json:"year"`
		Rate        *float64   `json:"rate"`
		IsEstimated bool       `json:"is_estimated"`
		AmountARS   float64    `json:"amount_ars"`
		AmountUSD   *float64   `json:"amount_usd"`
		PerPersonARS float64   `json:"per_person_ars"`
		PerPersonUSD *float64  `json:"per_person_usd"`
		Entries     []entryOut `json:"entries"`
	}

	months := make([]monthOut, 12)
	for i := 0; i < 12; i++ {
		m := i + 1
		var mo monthOut
		mo.Month = m
		mo.Year = year

		var totalARS float64
		if s.Currency == "ARS" {
			if s.AmountARS != nil {
				totalARS = *s.AmountARS
			}
			mo.Rate = nil
			mo.IsEstimated = false
			mo.AmountUSD = nil
			mo.PerPersonUSD = nil
		} else {
			rate, estimated := getRate(m, year)
			mo.Rate = &rate
			mo.IsEstimated = estimated
			totalARS = s.AmountUSD * rate
			amtUSD := s.AmountUSD
			mo.AmountUSD = &amtUSD
			perUSD := s.AmountUSD / float64(participantCount)
			mo.PerPersonUSD = &perUSD
		}
		mo.AmountARS = totalARS
		if participantCount > 0 {
			mo.PerPersonARS = totalARS / float64(participantCount)
		}

		// entries per participant
		for _, p := range participants {
			color := entryMap[entryKey{p.ID, m}]
			mo.Entries = append(mo.Entries, entryOut{
				ParticipantID: p.ID,
				Color:         color,
			})
		}
		months[i] = mo
	}

	type splitOut struct {
		ID            int      `json:"id"`
		Name          string   `json:"name"`
		RecurringID   int      `json:"recurring_id"`
		RecurringName string   `json:"recurring_name"`
		AmountUSD     float64  `json:"amount_usd"`
		AmountARS     *float64 `json:"amount_ars"`
		Currency      string   `json:"currency"`
	}

	result := map[string]any{
		"split": splitOut{
			ID:            s.ID,
			Name:          s.Name,
			RecurringID:   s.RecurringID,
			RecurringName: s.RecurringName,
			AmountUSD:     s.AmountUSD,
			AmountARS:     s.AmountARS,
			Currency:      s.Currency,
		},
		"participants": participants,
		"months":       months,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}
