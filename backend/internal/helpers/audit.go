package helpers

import (
	"context"
	"encoding/json"
	"log"

	"github.com/Ren14/gastos-tarjeta/internal/db"
)

// LogAudit inserts a row into audit_log in a goroutine so it never blocks
// the main request. Errors are logged but never propagated.
func LogAudit(ctx context.Context, entityType string, entityID int, action, description string, oldValue, newValue interface{}) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("audit log panic: %v", r)
			}
		}()

		var oldJSON, newJSON []byte
		var err error
		if oldValue != nil {
			if oldJSON, err = json.Marshal(oldValue); err != nil {
				oldJSON = nil
			}
		}
		if newValue != nil {
			if newJSON, err = json.Marshal(newValue); err != nil {
				newJSON = nil
			}
		}

		var oldArg, newArg interface{}
		if oldJSON != nil {
			oldArg = string(oldJSON)
		}
		if newJSON != nil {
			newArg = string(newJSON)
		}

		_, dbErr := db.Pool.Exec(context.Background(),
			`INSERT INTO audit_log (entity_type, entity_id, action, description, old_value, new_value)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			entityType, entityID, action, description, oldArg, newArg,
		)
		if dbErr != nil {
			log.Printf("audit log error: %v", dbErr)
		}
	}()
}
