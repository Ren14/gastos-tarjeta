package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/db"
)

var monthNamesES = []string{"ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"}

// ── Telegram types ─────────────────────────────────────────────────────────────

type Update struct {
	UpdateID int      `json:"update_id"`
	Message  *Message `json:"message"`
}

type Message struct {
	MessageID int    `json:"message_id"`
	Chat      Chat   `json:"chat"`
	Text      string `json:"text"`
}

type Chat struct {
	ID int64 `json:"id"`
}

type card struct {
	ID   int
	Name string
}

// ── Webhook handler ───────────────────────────────────────────────────────────

func WebhookHandler(w http.ResponseWriter, r *http.Request) {
	// Verify secret token
	secret := os.Getenv("TELEGRAM_WEBHOOK_SECRET")
	if secret != "" && r.Header.Get("X-Telegram-Bot-Api-Secret-Token") != secret {
		w.WriteHeader(http.StatusOK) // Return 200 so Telegram stops retrying
		return
	}

	var update Update
	if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
		w.WriteHeader(http.StatusOK)
		return
	}

	if update.Message == nil || strings.TrimSpace(update.Message.Text) == "" {
		w.WriteHeader(http.StatusOK)
		return
	}

	// Verify chat ID — ignore messages from other chats silently
	chatID := update.Message.Chat.ID
	expectedChatID := os.Getenv("TELEGRAM_CHAT_ID")
	if expectedChatID != "" && strconv.FormatInt(chatID, 10) != expectedChatID {
		w.WriteHeader(http.StatusOK)
		return
	}

	text := strings.TrimSpace(update.Message.Text)

	var reply string
	switch {
	case strings.HasPrefix(text, "/tarjetas"):
		reply = handleTarjetas(r.Context())
	case strings.HasPrefix(text, "/ayuda"), strings.HasPrefix(text, "/help"):
		reply = handleHelp()
	case strings.HasPrefix(text, "/ultimo"):
		reply = handleUltimo(r.Context())
	case strings.HasPrefix(text, "/cancelar"), strings.HasPrefix(text, "/start"):
		reply = "✅ Listo, podés registrar gastos cuando quieras.\n\n" + helpHint()
	default:
		reply = handleExpense(r.Context(), text)
	}

	sendMessage(chatID, reply)
	w.WriteHeader(http.StatusOK)
}

// ── Command handlers ──────────────────────────────────────────────────────────

func handleHelp() string {
	return "📖 *Cómo registrar gastos:*\n\n" +
		"Formato: `Comercio monto [cuotas] Tarjeta`\n\n" +
		"*Ejemplos:*\n" +
		"• Shell 63000 efectivo Visa San Rio\n" +
		"• Zapatillas 90000 3 cuotas AMEX\n" +
		"• Netflix 8946 1 cuota Visa San Rio\n" +
		"• Puma 150000 6c Mercado Pago\n\n" +
		"*Comandos:*\n" +
		"/tarjetas — ver tarjetas disponibles\n" +
		"/ultimo — ver últimos 5 gastos\n" +
		"/ayuda — mostrar esta ayuda"
}

func handleTarjetas(ctx context.Context) string {
	cards, err := loadCards(ctx)
	if err != nil || len(cards) == 0 {
		return "❌ No se pudieron cargar las tarjetas."
	}
	var sb strings.Builder
	sb.WriteString("💳 *Tarjetas disponibles:*\n")
	for _, c := range cards {
		fmt.Fprintf(&sb, "• %s\n", c.Name)
	}
	return sb.String()
}

func handleUltimo(ctx context.Context) string {
	rows, err := db.Pool.Query(ctx,
		`SELECT e.merchant, e.total_amount, e.installments, e.purchase_date, c.name
		 FROM expenses e
		 JOIN cards c ON c.id = e.card_id
		 ORDER BY e.created_at DESC
		 LIMIT 5`)
	if err != nil {
		return "❌ Error al cargar los últimos gastos."
	}
	defer rows.Close()

	var sb strings.Builder
	sb.WriteString("🧾 *Últimos 5 gastos:*\n")
	n := 0
	for rows.Next() {
		var merchant, cardName string
		var totalAmount float64
		var installments int
		var purchaseDate time.Time
		if err := rows.Scan(&merchant, &totalAmount, &installments, &purchaseDate, &cardName); err != nil {
			continue
		}
		inst := ""
		if installments > 1 {
			inst = fmt.Sprintf(" (%d cuotas)", installments)
		}
		fmt.Fprintf(&sb, "• %s $%.0f%s — %s (%s)\n",
			merchant, totalAmount, inst, cardName, purchaseDate.Format("02/01"))
		n++
	}
	if n == 0 {
		return "Sin gastos registrados aún."
	}
	return sb.String()
}

// ── Expense handler ───────────────────────────────────────────────────────────

func handleExpense(ctx context.Context, text string) string {
	tokens := strings.Fields(text)
	if len(tokens) < 2 {
		return helpError()
	}

	// Find the amount token index
	amountIdx := -1
	var amount float64
	for i, tok := range tokens {
		if v, ok := parseAmount(tok); ok {
			amountIdx = i
			amount = v
			break
		}
	}

	if amountIdx < 0 {
		return "❌ No encontré el monto en el mensaje.\n\n" + helpHint()
	}
	if amountIdx == 0 {
		return "❌ Falta el nombre del comercio.\n\n" + helpHint()
	}

	merchant := strings.Join(tokens[:amountIdx], " ")

	// Parse installments from tokens after amount
	rest := tokens[amountIdx+1:]
	installments, consumed := parseInstallments(rest)
	rest = rest[consumed:]

	if len(rest) == 0 {
		cards, _ := loadCards(ctx)
		var names []string
		for _, c := range cards {
			names = append(names, "• "+c.Name)
		}
		return "❌ Falta la tarjeta.\n\nTarjetas disponibles:\n" + strings.Join(names, "\n")
	}

	// Load and match card
	cards, err := loadCards(ctx)
	if err != nil {
		return "❌ Error al cargar las tarjetas."
	}

	matched, ambiguous := matchCard(cards, rest)
	if ambiguous != nil {
		var names []string
		for _, c := range ambiguous {
			names = append(names, "• "+c.Name)
		}
		return "❓ Encontré varias tarjetas que coinciden. ¿Cuál es?\n" + strings.Join(names, "\n")
	}
	if matched == nil {
		var names []string
		for _, c := range cards {
			names = append(names, "• "+c.Name)
		}
		return "❌ No encontré la tarjeta.\n\nTarjetas disponibles:\n" + strings.Join(names, "\n")
	}

	// Get Argentina date
	loc, err := time.LoadLocation("America/Argentina/Mendoza")
	if err != nil {
		loc = time.UTC
	}
	purchaseDate := time.Now().In(loc).Format("2006-01-02")

	// Insert expense
	var expID int
	var installmentAmount float64
	err = db.Pool.QueryRow(ctx,
		`INSERT INTO expenses (card_id, merchant, total_amount, installments, purchase_date)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, installment_amount`,
		matched.ID, merchant, amount, installments, purchaseDate,
	).Scan(&expID, &installmentAmount)
	if err != nil {
		return "❌ Error al registrar el gasto: " + err.Error()
	}

	// Format response
	impactStr := formatImpactMonths(purchaseDate, installments)

	var amountLine string
	if installments == 1 {
		amountLine = fmt.Sprintf("💰 $%.0f — Contado", amount)
	} else {
		amountLine = fmt.Sprintf("💰 $%.0f — %d cuotas de $%.0f", amount, installments, installmentAmount)
	}

	return fmt.Sprintf("✅ Gasto registrado:\n💳 %s\n🏪 %s\n%s\n📅 Impacta en: %s",
		matched.Name, merchant, amountLine, impactStr)
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

func parseAmount(s string) (float64, bool) {
	// Strip thousand separators (periods or commas used as grouping)
	clean := strings.ReplaceAll(s, ".", "")
	clean = strings.ReplaceAll(clean, ",", "")
	v, err := strconv.ParseFloat(clean, 64)
	if err != nil || v <= 0 {
		return 0, false
	}
	return v, true
}

var reNcuotas = regexp.MustCompile(`(?i)^(\d+)[cx]$`)

// parseInstallments reads installment info from the start of tokens.
// Returns installments count and the number of tokens consumed.
func parseInstallments(tokens []string) (int, int) {
	if len(tokens) == 0 {
		return 1, 0
	}

	lower0 := strings.ToLower(tokens[0])

	// "efectivo" or "contado" → 1 installment
	if lower0 == "efectivo" || lower0 == "contado" {
		return 1, 1
	}

	// "6c", "3x" etc.
	if m := reNcuotas.FindStringSubmatch(tokens[0]); m != nil {
		if n, err := strconv.Atoi(m[1]); err == nil && n > 0 {
			return n, 1
		}
	}

	// "3 cuotas", "3 cuota", "3 c", "3 x"
	if len(tokens) >= 2 {
		if n, err := strconv.Atoi(tokens[0]); err == nil && n > 0 {
			lower1 := strings.ToLower(tokens[1])
			if lower1 == "cuotas" || lower1 == "cuota" || lower1 == "c" || lower1 == "x" {
				return n, 2
			}
		}
	}

	return 1, 0
}

// ── Card matching ─────────────────────────────────────────────────────────────

// matchCard tries to find the best card match for the given tokens.
// It tries progressively shorter prefixes of the token list.
// Returns (matched, nil) for unique match, (nil, candidates) for ambiguous, (nil, nil) for no match.
func matchCard(cards []card, tokens []string) (*card, []card) {
	for size := len(tokens); size > 0; size-- {
		sub := strings.ToLower(strings.Join(tokens[:size], " "))

		var candidates []card
		for _, c := range cards {
			cLow := strings.ToLower(c.Name)
			if cLow == sub || strings.Contains(cLow, sub) || strings.Contains(sub, cLow) {
				candidates = append(candidates, c)
			}
		}

		if len(candidates) == 1 {
			return &candidates[0], nil
		}
		if len(candidates) > 1 {
			// Prefer exact match
			for _, c := range candidates {
				cc := c
				if strings.EqualFold(c.Name, strings.Join(tokens[:size], " ")) {
					return &cc, nil
				}
			}
			return nil, candidates
		}
	}
	return nil, nil
}

func loadCards(ctx context.Context) ([]card, error) {
	rows, err := db.Pool.Query(ctx,
		"SELECT id, name FROM cards WHERE active = true ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cards []card
	for rows.Next() {
		var c card
		if err := rows.Scan(&c.ID, &c.Name); err != nil {
			continue
		}
		cards = append(cards, c)
	}
	return cards, nil
}

// ── Impact months ─────────────────────────────────────────────────────────────

func formatImpactMonths(purchaseDateStr string, installments int) string {
	purchaseDate, _ := time.Parse("2006-01-02", purchaseDateStr)

	lastDay := time.Date(purchaseDate.Year(), purchaseDate.Month()+1, 0, 0, 0, 0, 0, purchaseDate.Location())
	daysFromEnd := lastDay.Day() - purchaseDate.Day()

	var firstImpact time.Time
	if daysFromEnd < 2 {
		firstImpact = time.Date(purchaseDate.Year(), purchaseDate.Month()+2, 1, 0, 0, 0, 0, purchaseDate.Location())
	} else {
		firstImpact = time.Date(purchaseDate.Year(), purchaseDate.Month()+1, 1, 0, 0, 0, 0, purchaseDate.Location())
	}

	parts := make([]string, installments)
	for i := 0; i < installments; i++ {
		m := time.Date(firstImpact.Year(), firstImpact.Month()+time.Month(i), 1, 0, 0, 0, 0, time.UTC)
		parts[i] = fmt.Sprintf("%s/%d", monthNamesES[m.Month()-1], m.Year())
	}
	return strings.Join(parts, ", ")
}

// ── Telegram API ──────────────────────────────────────────────────────────────

func sendMessage(chatID int64, text string) {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		return
	}
	body, _ := json.Marshal(map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "Markdown",
	})
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	resp, err := http.Post(apiURL, "application/json", bytes.NewReader(body)) //nolint
	if err == nil {
		resp.Body.Close()
	}
}

// ── Error messages ────────────────────────────────────────────────────────────

func helpHint() string {
	return "Formato: `Comercio monto [cuotas] Tarjeta`\n\n" +
		"Ejemplos:\n" +
		"• Shell 63000 efectivo Visa San Rio\n" +
		"• Zapatillas 90000 3 cuotas AMEX\n" +
		"• Puma 150000 6c Mercado Pago"
}

func helpError() string {
	return "❌ No pude registrar el gasto.\n\n" + helpHint()
}
