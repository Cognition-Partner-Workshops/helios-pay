package ledger

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestNewService(t *testing.T) {
	service := NewService("redis://localhost:6379/0")
	if service.redis == nil {
		t.Fatal("expected Redis client to be initialized")
	}
}

// lockingRepo mirrors what PostgresRepo does with its row lock: the balance
// check and the write happen under one lock per invoice.
type lockingRepo struct {
	mu      sync.Mutex
	balance int64
}

func (repo *lockingRepo) ApplyRefund(_ context.Context, _ string, amount int64) (int64, error) {
	repo.mu.Lock()
	defer repo.mu.Unlock()
	if repo.balance < amount {
		return 0, ErrInsufficientBalance
	}
	time.Sleep(50 * time.Millisecond)
	repo.balance -= amount
	return repo.balance, nil
}

func TestRefundConcurrentFullBalanceOnlyOneSucceeds(t *testing.T) {
	repo := &lockingRepo{balance: 100}
	service := NewServiceWithRepo("redis://localhost:6379/0", repo)
	var waitGroup sync.WaitGroup
	errs := make(chan error, 2)
	for range 2 {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			_, err := service.Refund(context.Background(), "invoice-1", 100)
			errs <- err
		}()
	}
	waitGroup.Wait()
	close(errs)
	var successes, insufficient int
	for err := range errs {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, ErrInsufficientBalance):
			insufficient++
		default:
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if successes != 1 || insufficient != 1 {
		t.Fatalf("expected exactly one refund to succeed, got %d successes and %d insufficient-balance errors", successes, insufficient)
	}
	if repo.balance != 0 {
		t.Fatalf("expected balance 0 after a single full refund, got %d", repo.balance)
	}
}

func TestRefundRejectsNonPositiveAmount(t *testing.T) {
	repo := &lockingRepo{balance: 100}
	service := NewServiceWithRepo("redis://localhost:6379/0", repo)
	for _, amount := range []int64{0, -50} {
		if _, err := service.Refund(context.Background(), "invoice-1", amount); !errors.Is(err, ErrInvalidAmount) {
			t.Fatalf("amount %d: expected ErrInvalidAmount, got %v", amount, err)
		}
	}
	if repo.balance != 100 {
		t.Fatalf("expected balance untouched, got %d", repo.balance)
	}
}

func TestRefundWithoutRepo(t *testing.T) {
	service := NewService("redis://localhost:6379/0")
	service.repo = nil
	if _, err := service.Refund(context.Background(), "invoice-1", 10); err == nil {
		t.Fatal("expected error when repository is not configured")
	}
}
