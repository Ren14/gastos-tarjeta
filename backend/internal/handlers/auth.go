package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/db"
	"github.com/Ren14/gastos-tarjeta/internal/email"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type registerRequest struct {
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Password    string `json:"password"`
}

func issueToken(userID int, userEmail string) (string, time.Time, error) {
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":     userEmail,
		"user_id": userID,
		"exp":     expiresAt.Unix(),
		"iat":     time.Now().Unix(),
	})
	tokenStr, err := token.SignedString([]byte(os.Getenv("JWT_SECRET")))
	return tokenStr, expiresAt, err
}

func Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	var userID int
	var passwordHash string
	err := db.Pool.QueryRow(r.Context(),
		`SELECT id, password_hash FROM users WHERE email = $1`, req.Email,
	).Scan(&userID, &passwordHash)

	if errors.Is(err, pgx.ErrNoRows) || err != nil {
		jsonError(w, "Credenciales inválidas", http.StatusUnauthorized)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		jsonError(w, "Credenciales inválidas", http.StatusUnauthorized)
		return
	}

	tokenStr, expiresAt, err := issueToken(userID, req.Email)
	if err != nil {
		jsonError(w, "failed to generate token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token":      tokenStr,
		"expires_at": expiresAt.Format(time.RFC3339),
	})
}

func Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if !strings.Contains(req.Email, "@") {
		jsonError(w, "Email inválido", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		jsonError(w, "La contraseña debe tener al menos 8 caracteres", http.StatusBadRequest)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "error procesando contraseña", http.StatusInternalServerError)
		return
	}

	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = req.Email
	}

	var userID int
	err = db.Pool.QueryRow(r.Context(),
		`INSERT INTO users (email, display_name, password_hash)
		 VALUES ($1, $2, $3)
		 RETURNING id`,
		req.Email, displayName, string(hash),
	).Scan(&userID)
	if err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			jsonError(w, "Ya existe una cuenta con ese email", http.StatusConflict)
			return
		}
		jsonError(w, "error al crear usuario", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]any{
		"id":           userID,
		"email":        req.Email,
		"display_name": displayName,
	})
}

func RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	// Always respond 200 — never reveal whether the email exists
	okResponse := func() {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Si el email está registrado, recibirás un enlace en breve.",
		})
	}

	var userID int
	err := db.Pool.QueryRow(r.Context(),
		`SELECT id FROM users WHERE email = $1`, req.Email,
	).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) || err != nil {
		okResponse()
		return
	}

	// Generate a 32-byte random token, store its SHA-256 hash
	rawBytes := make([]byte, 32)
	if _, err := rand.Read(rawBytes); err != nil {
		jsonError(w, "error generando token", http.StatusInternalServerError)
		return
	}
	rawToken := hex.EncodeToString(rawBytes)
	hash := sha256.Sum256([]byte(rawToken))
	tokenHash := hex.EncodeToString(hash[:])
	expiresAt := time.Now().Add(1 * time.Hour)

	_, err = db.Pool.Exec(r.Context(),
		`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3)`,
		userID, tokenHash, expiresAt,
	)
	if err != nil {
		jsonError(w, "error guardando token", http.StatusInternalServerError)
		return
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	resetURL := frontendURL + "/reset-password?token=" + rawToken

	// Send email asynchronously — don't block the response
	go func() {
		_ = email.SendPasswordReset(req.Email, resetURL)
	}()

	okResponse()
}

func ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if len(req.Password) < 8 {
		jsonError(w, "La contraseña debe tener al menos 8 caracteres", http.StatusBadRequest)
		return
	}

	hash := sha256.Sum256([]byte(req.Token))
	tokenHash := hex.EncodeToString(hash[:])

	var tokenID, userID int
	err := db.Pool.QueryRow(r.Context(),
		`SELECT id, user_id FROM password_reset_tokens
		 WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
		tokenHash,
	).Scan(&tokenID, &userID)
	if errors.Is(err, pgx.ErrNoRows) || err != nil {
		jsonError(w, "El enlace es inválido o ya expiró", http.StatusBadRequest)
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonError(w, "error procesando contraseña", http.StatusInternalServerError)
		return
	}

	// Update password and mark token as used in a single transaction
	tx, err := db.Pool.Begin(r.Context())
	if err != nil {
		jsonError(w, "error interno", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(),
		`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
		string(newHash), userID,
	)
	if err != nil {
		jsonError(w, "error actualizando contraseña", http.StatusInternalServerError)
		return
	}

	_, err = tx.Exec(r.Context(),
		`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
		tokenID,
	)
	if err != nil {
		jsonError(w, "error actualizando token", http.StatusInternalServerError)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		jsonError(w, "error interno", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Contraseña actualizada correctamente.",
	})
}

func jsonError(w http.ResponseWriter, msg string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
