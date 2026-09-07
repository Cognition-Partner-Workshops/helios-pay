package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/Cognition-Partner-Workshops/helios-pay-demo/services/ledger-worker/internal/ledger"
)

func main() {
	service := ledger.NewService(os.Getenv("REDIS_URL"))
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(response http.ResponseWriter, _ *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(response).Encode(map[string]string{"status": "ok", "service": "ledger-worker"})
	})
	mux.HandleFunc("/refunds", func(response http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			http.Error(response, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var payload struct {
			InvoiceID  string `json:"invoice_id"`
			AmountCents int64 `json:"amount_cents"`
		}
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			http.Error(response, "invalid request", http.StatusBadRequest)
			return
		}
		balanceAfter, err := service.Refund(
			context.Background(),
			payload.InvoiceID,
			payload.AmountCents,
		)
		if err != nil {
			http.Error(response, err.Error(), http.StatusBadRequest)
			return
		}
		response.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(response).Encode(map[string]any{
			"status":        "refunded",
			"balance_after": balanceAfter,
		})
	})
	log.Println("ledger-worker listening on :8090")
	log.Fatal(http.ListenAndServe(":8090", mux))
}
