package ledger

import (
	"context"
	"sync"
	"testing"
)

func TestNewService(t *testing.T) {
	service := NewService("redis://localhost:6379/0")
	if service.redis == nil {
		t.Fatal("expected Redis client to be initialized")
	}
}

type raceRepo struct {
	balance int64
}

func (repo *raceRepo) CurrentBalance(_ context.Context, _ string) (int64, error) {
	return repo.balance, nil
}

func (repo *raceRepo) InsertRefund(_ context.Context, _ string, amount, _ int64) error {
	repo.balance -= amount
	return nil
}

func TestRefundRaceDoubleSpend(t *testing.T) {
	repo := &raceRepo{balance: 100}
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
	for err := range errs {
		if err != nil {
			t.Fatalf("expected both refunds to succeed: %v", err)
		}
	}
	if repo.balance >= 0 {
		t.Fatalf("expected negative balance after double spend, got %d", repo.balance)
	}
}
