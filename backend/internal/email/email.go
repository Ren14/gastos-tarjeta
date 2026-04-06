package email

import (
	"fmt"
	"os"

	"github.com/resend/resend-go/v2"
)

func SendPasswordReset(toEmail, resetURL string) error {
	apiKey := os.Getenv("RESEND_API_KEY")
	from := os.Getenv("EMAIL_FROM")
	if apiKey == "" || from == "" {
		return fmt.Errorf("email: RESEND_API_KEY or EMAIL_FROM not configured")
	}

	client := resend.NewClient(apiKey)

	html := fmt.Sprintf(`
<p>Recibiste este email porque solicitaste restablecer tu contraseña en <strong>Gastos Tarjeta</strong>.</p>
<p>Hacé clic en el siguiente enlace para crear una nueva contraseña (expira en 1 hora):</p>
<p><a href="%s" style="background:#111;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Restablecer contraseña</a></p>
<p>Si no solicitaste este cambio, podés ignorar este email.</p>
`, resetURL)

	_, err := client.Emails.Send(&resend.SendEmailRequest{
		From:    from,
		To:      []string{toEmail},
		Subject: "Restablecer contraseña — Gastos Tarjeta",
		Html:    html,
	})
	return err
}
