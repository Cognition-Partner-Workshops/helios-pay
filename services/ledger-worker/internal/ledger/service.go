package ledger

import (
	"context"
	"errors"
	"os"
	"strings"

	"github.com/redis/go-redis/v9"
)

var (
	ErrInsufficientBalance = errors.New("insufficient balance")
	ErrInvalidAmount       = errors.New("refund amount must be positive")
	ErrInvoiceNotFound     = errors.New("invoice not found")
)

type Repo interface {
	// Refund checks the invoice balance and records the refund as one atomic step.
	Refund(ctx context.Context, invoiceID string, amount int64) (int64, error)
}

type Service struct {
	redis *redis.Client
	repo  Repo
}

func NewService(redisURL string) *Service {
	options, err := redis.ParseURL(redisURL)
	if err != nil {
		options = &redis.Options{Addr: "redis:6379"}
	}
	var repo Repo
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		repo, _ = NewPostgresRepo(databaseURL)
	}
	return &Service{redis: redis.NewClient(options), repo: repo}
}

func NewServiceWithRepo(redisURL string, repo Repo) *Service {
	service := NewService(redisURL)
	service.repo = repo
	return service
}

func (service *Service) Refund(ctx context.Context, invoiceID string, amount int64) (int64, error) {
	if service.repo == nil {
		return 0, errors.New("ledger repository is not configured")
	}
	if amount <= 0 {
		return 0, ErrInvalidAmount
	}
	return service.repo.Refund(ctx, invoiceID, amount)
}

func postgresDSN(databaseURL string) string {
	return strings.Replace(databaseURL, "postgresql+psycopg://", "postgres://", 1)
}
