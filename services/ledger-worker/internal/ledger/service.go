package ledger

import (
	"context"
	"errors"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var ErrInsufficientBalance = errors.New("insufficient balance")

type Repo interface {
	CurrentBalance(ctx context.Context, invoiceID string) (int64, error)
	InsertRefund(ctx context.Context, invoiceID string, amount, balanceAfter int64) error
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
	balance, err := service.repo.CurrentBalance(ctx, invoiceID)
	if err != nil {
		return 0, err
	}
	if balance < amount {
		return 0, ErrInsufficientBalance
	}
	time.Sleep(150 * time.Millisecond)
	balanceAfter := balance - amount
	if err := service.repo.InsertRefund(ctx, invoiceID, amount, balanceAfter); err != nil {
		return 0, err
	}
	return balanceAfter, nil
}

func postgresDSN(databaseURL string) string {
	return strings.Replace(databaseURL, "postgresql+psycopg://", "postgres://", 1)
}
