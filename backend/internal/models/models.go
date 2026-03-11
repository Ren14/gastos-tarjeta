package models

import "time"

type Card struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Bank      string    `json:"bank"`
	CardType  string    `json:"card_type"`
	ColorHex  string    `json:"color_hex"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
}

type Category struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Icon     string `json:"icon"`
	ColorHex string `json:"color_hex"`
}

type Expense struct {
	ID                int       `json:"id"`
	CardID            int       `json:"card_id"`
	CategoryID        *int      `json:"category_id"`
	Merchant          string    `json:"merchant"`
	TotalAmount       float64   `json:"total_amount"`
	Installments      int       `json:"installments"`
	InstallmentAmount float64   `json:"installment_amount"`
	PurchaseDate      string    `json:"purchase_date"`
	RecurringID       *int      `json:"recurring_id"`
	Notes             *string   `json:"notes"`
	CreatedAt         time.Time `json:"created_at"`
}

type ExchangeRate struct {
	ID        int       `json:"id"`
	Month     int       `json:"month"`
	Year      int       `json:"year"`
	UsdToArs  float64   `json:"usd_to_ars"`
	Notes     *string   `json:"notes"`
	CreatedAt time.Time `json:"created_at"`
}

type RecurringExpense struct {
	ID         int       `json:"id"`
	CardID     int       `json:"card_id"`
	CategoryID *int      `json:"category_id"`
	Merchant   string    `json:"merchant"`
	AmountUSD  float64   `json:"amount_usd"`
	Active     bool      `json:"active"`
	CreatedAt  time.Time `json:"created_at"`
}

// Response para el dashboard mensual
type MonthlyExpenseItem struct {
	ExpenseID         int     `json:"expense_id"`
	Merchant          string  `json:"merchant"`
	InstallmentAmount float64 `json:"installment_amount"`
	InstallmentNumber int     `json:"installment_number"`
	TotalInstallments int     `json:"total_installments"`
	CardID            int     `json:"card_id"`
	CardName          string  `json:"card_name"`
	CategoryID        *int    `json:"category_id"`
	IsRecurring       bool    `json:"is_recurring"`
	RecurringID       *int    `json:"recurring_id"`
	PurchaseDate      string  `json:"purchase_date"`
	TotalAmount       float64 `json:"total_amount"`
}

type MonthlySummary struct {
	Month    int                  `json:"month"`
	Year     int                  `json:"year"`
	Total    float64              `json:"total"`
	Expenses []MonthlyExpenseItem `json:"expenses"`
}

type CardSummary struct {
	CardID   int     `json:"card_id"`
	CardName string  `json:"card_name"`
	ColorHex string  `json:"color_hex"`
	Total    float64 `json:"total"`
}
