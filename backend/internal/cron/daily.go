package cron

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/Ren14/gastos-tarjeta/internal/db"
	"github.com/Ren14/gastos-tarjeta/internal/helpers"
	"github.com/robfig/cron/v3"
)

// StartCronJobs starts background scheduled jobs. Call once after db.Connect().
func StartCronJobs() {
	location, err := time.LoadLocation("America/Argentina/Mendoza")
	if err != nil {
		log.Printf("cron: failed to load timezone: %v", err)
		location = time.UTC
	}
	c := cron.New(cron.WithLocation(location))
	c.AddFunc("0 9 * * *", func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("cron: runDailyPaymentReminders panic: %v", r)
			}
		}()
		RunDailyPaymentReminders()
	})
	c.Start()
	log.Println("cron: daily payment reminders scheduled at 09:00 ART")
}

// ReminderSummary holds counts of tasks notified per group.
type ReminderSummary struct {
	Tomorrow int `json:"tomorrow"`
	Today    int `json:"today"`
	Overdue  int `json:"overdue"`
}

type taskInfo struct {
	ReferenceName string
	Amount        float64
}

// RunDailyPaymentReminders queries unpaid card_payment tasks due yesterday,
// today, and tomorrow, and sends one Telegram message per non-empty group.
// It returns a summary of how many tasks were notified in each group.
func RunDailyPaymentReminders() ReminderSummary {
	location, err := time.LoadLocation("America/Argentina/Mendoza")
	if err != nil {
		location = time.UTC
	}

	today := time.Now().In(location).Truncate(24 * time.Hour)
	tomorrow := today.AddDate(0, 0, 1)
	yesterday := today.AddDate(0, 0, -1)

	ctx := context.Background()

	queryTasks := func(dueDate time.Time) []taskInfo {
		rows, err := db.Pool.Query(ctx,
			`SELECT reference_name, amount
			 FROM todo_tasks
			 WHERE task_type = 'card_payment'
			   AND due_date = $1
			   AND completed_at IS NULL
			   AND due_date IS NOT NULL
			 ORDER BY amount DESC`,
			dueDate.Format("2006-01-02"),
		)
		if err != nil {
			log.Printf("cron: queryTasks error: %v", err)
			return nil
		}
		defer rows.Close()

		var tasks []taskInfo
		for rows.Next() {
			var t taskInfo
			if err := rows.Scan(&t.ReferenceName, &t.Amount); err != nil {
				log.Printf("cron: scan error: %v", err)
				continue
			}
			tasks = append(tasks, t)
		}
		return tasks
	}

	buildLines := func(tasks []taskInfo) string {
		var s string
		for _, t := range tasks {
			s += fmt.Sprintf("• 💳 %s — %s\n", t.ReferenceName, helpers.FormatARS(t.Amount))
		}
		return s
	}

	var summary ReminderSummary

	if tasks := queryTasks(tomorrow); len(tasks) > 0 {
		summary.Tomorrow = len(tasks)
		msg := "📅 <b>Recordatorio de vencimientos</b>\n\n" +
			"⚠️ <b>Vencen MAÑANA:</b>\n" +
			buildLines(tasks)
		helpers.SendTelegramMessage(msg)
	}

	if tasks := queryTasks(today); len(tasks) > 0 {
		summary.Today = len(tasks)
		msg := "🔔 <b>Recordatorio de vencimientos</b>\n\n" +
			"🚨 <b>Vencen HOY:</b>\n" +
			buildLines(tasks)
		helpers.SendTelegramMessage(msg)
	}

	if tasks := queryTasks(yesterday); len(tasks) > 0 {
		summary.Overdue = len(tasks)
		msg := "❗ <b>Recordatorio de vencimientos</b>\n\n" +
			"🔴 <b>Vencieron AYER (sin pagar):</b>\n" +
			buildLines(tasks)
		helpers.SendTelegramMessage(msg)
	}

	return summary
}
