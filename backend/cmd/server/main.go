package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"

	"github.com/Ren14/gastos-tarjeta/internal/db"
	"github.com/Ren14/gastos-tarjeta/internal/handlers"
)

func main() {
	godotenv.Load()
	db.Connect()
	defer db.Pool.Close()

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// CORS para desarrollo
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			if r.Method == "OPTIONS" {
				w.WriteHeader(http.StatusOK)
				return
			}
			next.ServeHTTP(w, r)
		})
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/cards", handlers.GetCards)
		r.Post("/cards", handlers.CreateCard)
		r.Put("/cards/{id}", handlers.UpdateCard)

		r.Get("/categories", handlers.GetCategories)

		r.Get("/expenses", handlers.GetExpenses)
		r.Post("/expenses", handlers.CreateExpense)
		r.Delete("/expenses/{id}", handlers.DeleteExpense)

		r.Get("/summary/monthly", handlers.GetMonthlySummary)
		r.Get("/summary/by-card", handlers.GetSummaryByCard)

		r.Get("/summary/projection", handlers.GetProjection)

		r.Get("/exchange-rates", handlers.GetExchangeRates)
		r.Post("/exchange-rates", handlers.CreateExchangeRate)
		r.Put("/exchange-rates/{id}", handlers.UpdateExchangeRate)

		r.Get("/recurring", handlers.GetRecurring)
		r.Post("/recurring/generate", handlers.GenerateRecurring)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server running on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
