package handlers

import (
	"encoding/json"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/db"
)

type TodoTask struct {
	ID            *int       `json:"id"`
	Month         int        `json:"month"`
	Year          int        `json:"year"`
	TaskType      string     `json:"task_type"`
	ReferenceID   int        `json:"reference_id"`
	ReferenceName string     `json:"reference_name"`
	Amount        float64    `json:"amount"`
	ColorHex      string     `json:"color_hex"`
	CompletedAt   *time.Time `json:"completed_at"`
	DueDate       *string    `json:"due_date"` // "YYYY-MM-DD" or null
	MPReserved      bool       `json:"mp_reserved"`
	PaymentInformed bool       `json:"payment_informed"`
}

// scanDueDate converts a scanned *time.Time DATE into a *string ("YYYY-MM-DD").
func scanDueDate(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format("2006-01-02")
	return &s
}

func GetTodos(w http.ResponseWriter, r *http.Request) {
	month, err := strconv.Atoi(r.URL.Query().Get("month"))
	if err != nil || month == 0 {
		http.Error(w, "missing month", http.StatusBadRequest)
		return
	}
	year, err := strconv.Atoi(r.URL.Query().Get("year"))
	if err != nil || year == 0 {
		http.Error(w, "missing year", http.StatusBadRequest)
		return
	}

	// ── 1. Card totals for this month ──────────────────────────────────────────
	type cardInfo struct {
		ID       int
		Name     string
		ColorHex string
		Total    float64
	}
	cardRows, err := db.Pool.Query(r.Context(),
		"SELECT id, name, COALESCE(color_hex,'') FROM cards WHERE active = true ORDER BY name")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer cardRows.Close()

	cardMap := map[int]*cardInfo{}
	cardOrder := []int{}
	for cardRows.Next() {
		var c cardInfo
		cardRows.Scan(&c.ID, &c.Name, &c.ColorHex)
		cardMap[c.ID] = &c
		cardOrder = append(cardOrder, c.ID)
	}
	cardRows.Close()

	cardTotals, err := computeCardTotalsForMonth(r.Context(), month, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	for cardID, total := range cardTotals {
		if c, ok := cardMap[cardID]; ok {
			c.Total = total
		}
	}

	// ── 2. Cobranzas totals for this month ─────────────────────────────────────
	type cobranzaGroup struct {
		ClasifID   int
		ClasifName string
		Total      float64
	}

	catClasifRows, err := db.Pool.Query(r.Context(),
		`SELECT c.id, c.clasificacion_id, COALESCE(cl.name, '')
		 FROM cashflow_categories c
		 LEFT JOIN flujo_clasificaciones cl ON cl.id = c.clasificacion_id
		 WHERE c.active = true AND c.clasificacion_id IS NOT NULL`)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer catClasifRows.Close()

	type catClasif struct {
		CatID      int
		ClasifID   int
		ClasifName string
	}
	var catClasifs []catClasif
	for catClasifRows.Next() {
		var cc catClasif
		catClasifRows.Scan(&cc.CatID, &cc.ClasifID, &cc.ClasifName)
		if !excludedClasifNames[cc.ClasifName] {
			catClasifs = append(catClasifs, cc)
		}
	}
	catClasifRows.Close()

	catToClasif := map[int]catClasif{}
	for _, cc := range catClasifs {
		catToClasif[cc.CatID] = cc
	}

	entryRows, err := db.Pool.Query(r.Context(),
		`SELECT category_id, amount FROM cashflow_entries WHERE month = $1 AND year = $2`, month, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer entryRows.Close()

	cobranzaGroupOrder := []int{}
	cobranzaGroups := map[int]*cobranzaGroup{}
	for entryRows.Next() {
		var catID int
		var amount float64
		entryRows.Scan(&catID, &amount)
		cc, ok := catToClasif[catID]
		if !ok {
			continue
		}
		if _, exists := cobranzaGroups[cc.ClasifID]; !exists {
			cobranzaGroupOrder = append(cobranzaGroupOrder, cc.ClasifID)
			cobranzaGroups[cc.ClasifID] = &cobranzaGroup{
				ClasifID:   cc.ClasifID,
				ClasifName: cc.ClasifName,
			}
		}
		cobranzaGroups[cc.ClasifID].Total += amount
	}
	entryRows.Close()

	// ── 3. Load persisted todo_tasks for this month/year ───────────────────────
	type persistedKey struct {
		TaskType    string
		ReferenceID int
	}
	persisted := map[persistedKey]*TodoTask{}

	dbRows, err := db.Pool.Query(r.Context(),
		`SELECT id, task_type, reference_id, reference_name, amount, completed_at, due_date, mp_reserved, payment_informed
		 FROM todo_tasks WHERE month = $1 AND year = $2`, month, year)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer dbRows.Close()

	for dbRows.Next() {
		var t TodoTask
		var id int
		var dueDateT *time.Time
		dbRows.Scan(&id, &t.TaskType, &t.ReferenceID, &t.ReferenceName, &t.Amount, &t.CompletedAt, &dueDateT, &t.MPReserved, &t.PaymentInformed)
		t.ID = &id
		t.Month = month
		t.Year = year
		t.DueDate = scanDueDate(dueDateT)
		persisted[persistedKey{t.TaskType, t.ReferenceID}] = &t
	}
	dbRows.Close()

	// ── 4. Build response ──────────────────────────────────────────────────────
	var cardTasks []TodoTask
	for _, id := range cardOrder {
		c := cardMap[id]
		if c.Total <= 0 {
			continue
		}
		task := TodoTask{
			Month:         month,
			Year:          year,
			TaskType:      "card_payment",
			ReferenceID:   c.ID,
			ReferenceName: c.Name,
			Amount:        c.Total,
			ColorHex:      c.ColorHex,
		}
		if p, ok := persisted[persistedKey{"card_payment", c.ID}]; ok {
			task.ID = p.ID
			task.CompletedAt = p.CompletedAt
			task.DueDate = p.DueDate
			task.MPReserved = p.MPReserved
		}
		cardTasks = append(cardTasks, task)
	}
	sort.Slice(cardTasks, func(i, j int) bool {
		return cardTasks[i].Amount > cardTasks[j].Amount
	})

	var cobranzaTasks []TodoTask
	for _, cid := range cobranzaGroupOrder {
		g := cobranzaGroups[cid]
		if g.Total <= 0 {
			continue
		}
		task := TodoTask{
			Month:         month,
			Year:          year,
			TaskType:      "cobranza",
			ReferenceID:   g.ClasifID,
			ReferenceName: g.ClasifName,
			Amount:        g.Total,
		}
		if p, ok := persisted[persistedKey{"cobranza", g.ClasifID}]; ok {
			task.ID = p.ID
			task.CompletedAt = p.CompletedAt
			task.PaymentInformed = p.PaymentInformed
		}
		cobranzaTasks = append(cobranzaTasks, task)
	}
	sort.Slice(cobranzaTasks, func(i, j int) bool {
		return cobranzaTasks[i].Amount > cobranzaTasks[j].Amount
	})

	result := append(cardTasks, cobranzaTasks...)
	if result == nil {
		result = []TodoTask{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func CompleteTodo(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Month         int     `json:"month"`
		Year          int     `json:"year"`
		TaskType      string  `json:"task_type"`
		ReferenceID   int     `json:"reference_id"`
		ReferenceName string  `json:"reference_name"`
		Amount        float64 `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Check if already completed
	var completedAt *time.Time
	err := db.Pool.QueryRow(r.Context(),
		`SELECT completed_at FROM todo_tasks WHERE month=$1 AND year=$2 AND task_type=$3 AND reference_id=$4`,
		req.Month, req.Year, req.TaskType, req.ReferenceID,
	).Scan(&completedAt)

	if err == nil && completedAt != nil {
		http.Error(w, `{"error":"already_completed","message":"Esta tarea ya fue completada"}`, http.StatusConflict)
		return
	}

	var t TodoTask
	var id int
	var dueDateT *time.Time
	// Note: due_date is preserved on complete (not overwritten)
	err = db.Pool.QueryRow(r.Context(),
		`INSERT INTO todo_tasks (month, year, task_type, reference_id, reference_name, amount, completed_at)
		 VALUES ($1, $2, $3, $4, $5, $6, NOW())
		 ON CONFLICT (month, year, task_type, reference_id) DO UPDATE
		   SET completed_at = NOW(), reference_name = EXCLUDED.reference_name, amount = EXCLUDED.amount
		 RETURNING id, month, year, task_type, reference_id, reference_name, amount, completed_at, due_date`,
		req.Month, req.Year, req.TaskType, req.ReferenceID, req.ReferenceName, req.Amount,
	).Scan(&id, &t.Month, &t.Year, &t.TaskType, &t.ReferenceID, &t.ReferenceName, &t.Amount, &t.CompletedAt, &dueDateT)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	t.ID = &id
	t.DueDate = scanDueDate(dueDateT)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}

func UncompleteTodo(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Month       int    `json:"month"`
		Year        int    `json:"year"`
		TaskType    string `json:"task_type"`
		ReferenceID int    `json:"reference_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := db.Pool.Exec(r.Context(),
		`UPDATE todo_tasks SET completed_at = NULL
		 WHERE month=$1 AND year=$2 AND task_type=$3 AND reference_id=$4`,
		req.Month, req.Year, req.TaskType, req.ReferenceID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func UpdateTodoMPReserved(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Month         int     `json:"month"`
		Year          int     `json:"year"`
		TaskType      string  `json:"task_type"`
		ReferenceID   int     `json:"reference_id"`
		ReferenceName string  `json:"reference_name"`
		Amount        float64 `json:"amount"`
		MPReserved    bool    `json:"mp_reserved"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := db.Pool.Exec(r.Context(),
		`INSERT INTO todo_tasks (month, year, task_type, reference_id, reference_name, amount, mp_reserved)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (month, year, task_type, reference_id) DO UPDATE
		   SET mp_reserved = EXCLUDED.mp_reserved,
		       reference_name = EXCLUDED.reference_name,
		       amount = EXCLUDED.amount`,
		req.Month, req.Year, req.TaskType, req.ReferenceID, req.ReferenceName, req.Amount, req.MPReserved,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func UpdateTodoPaymentInformed(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Month           int     `json:"month"`
		Year            int     `json:"year"`
		TaskType        string  `json:"task_type"`
		ReferenceID     int     `json:"reference_id"`
		ReferenceName   string  `json:"reference_name"`
		Amount          float64 `json:"amount"`
		PaymentInformed bool    `json:"payment_informed"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := db.Pool.Exec(r.Context(),
		`INSERT INTO todo_tasks (month, year, task_type, reference_id, reference_name, amount, payment_informed)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (month, year, task_type, reference_id) DO UPDATE
		   SET payment_informed = EXCLUDED.payment_informed,
		       reference_name = EXCLUDED.reference_name,
		       amount = EXCLUDED.amount`,
		req.Month, req.Year, req.TaskType, req.ReferenceID, req.ReferenceName, req.Amount, req.PaymentInformed,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func UpdateTodoDueDate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Month         int     `json:"month"`
		Year          int     `json:"year"`
		TaskType      string  `json:"task_type"`
		ReferenceID   int     `json:"reference_id"`
		ReferenceName string  `json:"reference_name"`
		Amount        float64 `json:"amount"`
		DueDate       *string `json:"due_date"` // "YYYY-MM-DD" or null to clear
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	var t TodoTask
	var id int
	var dueDateT *time.Time
	err := db.Pool.QueryRow(r.Context(),
		`INSERT INTO todo_tasks (month, year, task_type, reference_id, reference_name, amount, due_date)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (month, year, task_type, reference_id) DO UPDATE
		   SET due_date = EXCLUDED.due_date,
		       reference_name = EXCLUDED.reference_name,
		       amount = EXCLUDED.amount
		 RETURNING id, month, year, task_type, reference_id, reference_name, amount, completed_at, due_date`,
		req.Month, req.Year, req.TaskType, req.ReferenceID, req.ReferenceName, req.Amount, req.DueDate,
	).Scan(&id, &t.Month, &t.Year, &t.TaskType, &t.ReferenceID, &t.ReferenceName, &t.Amount, &t.CompletedAt, &dueDateT)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	t.ID = &id
	t.DueDate = scanDueDate(dueDateT)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}
