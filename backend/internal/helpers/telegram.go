package helpers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
)

// FormatARS formats a float as Argentine pesos with dots as thousands separator.
// e.g. 1006388 → "$1.006.388", 63005 → "$63.005"
func FormatARS(amount float64) string {
	n := int64(math.Round(amount))
	s := strconv.FormatInt(n, 10)
	var result strings.Builder
	rem := len(s) % 3
	for i, ch := range s {
		if i > 0 && (i-rem)%3 == 0 {
			result.WriteByte('.')
		}
		result.WriteRune(ch)
	}
	return "$" + result.String()
}

// SendTelegramMessage sends a message to the configured Telegram chat using HTML parse mode.
// It is safe to call from goroutines; errors are logged but never propagated.
func SendTelegramMessage(text string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("telegram send panic: %v", r)
		}
	}()

	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	chatID := os.Getenv("TELEGRAM_CHAT_ID")
	if token == "" || chatID == "" {
		return
	}

	body, _ := json.Marshal(map[string]interface{}{
		"chat_id":    chatID,
		"text":       text,
		"parse_mode": "HTML",
	})

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	resp, err := http.Post(apiURL, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("telegram send error: %v", err)
		return
	}
	resp.Body.Close()
}
