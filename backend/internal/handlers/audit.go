package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/db"
	"github.com/jackc/pgx/v5"
)

type AuditEntry struct {
	ID          int       `json:"id"`
	EntityType  string    `json:"entity_type"`
	EntityID    *int      `json:"entity_id"`
	Action      string    `json:"action"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type AuditResponse struct {
	Total int          `json:"total"`
	Items []AuditEntry `json:"items"`
}

func GetAuditLog(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	entityType := r.URL.Query().Get("entity_type")

	var total int
	if entityType != "" {
		db.Pool.QueryRow(r.Context(),
			"SELECT COUNT(*) FROM audit_log WHERE entity_type = $1", entityType,
		).Scan(&total)
	} else {
		db.Pool.QueryRow(r.Context(), "SELECT COUNT(*) FROM audit_log").Scan(&total)
	}

	var rows pgx.Rows
	var err error
	if entityType != "" {
		rows, err = db.Pool.Query(r.Context(),
			`SELECT id, entity_type, entity_id, action, description, created_at
			 FROM audit_log WHERE entity_type = $1
			 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
			entityType, limit, offset)
	} else {
		rows, err = db.Pool.Query(r.Context(),
			`SELECT id, entity_type, entity_id, action, description, created_at
			 FROM audit_log ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
			limit, offset)
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	items := []AuditEntry{}
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(&e.ID, &e.EntityType, &e.EntityID, &e.Action, &e.Description, &e.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		items = append(items, e)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AuditResponse{Total: total, Items: items})
}
