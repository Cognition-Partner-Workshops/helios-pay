package ledger

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"
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

type fakeRepo struct {
	calls int
}

func (repo *fakeRepo) Refund(_ context.Context, _ string, amount int64) (int64, error) {
	repo.calls++
	return 100 - amount, nil
}

func TestRefundRejectsNonPositiveAmount(t *testing.T) {
	repo := &fakeRepo{}
	service := NewServiceWithRepo("redis://localhost:6379/0", repo)
	for _, amount := range []int64{0, -100} {
		if _, err := service.Refund(context.Background(), "invoice-1", amount); !errors.Is(err, ErrInvalidAmount) {
			t.Fatalf("amount %d: expected ErrInvalidAmount, got %v", amount, err)
		}
	}
	if repo.calls != 0 {
		t.Fatalf("expected no repository call, got %d", repo.calls)
	}
	if balanceAfter, err := service.Refund(context.Background(), "invoice-1", 40); err != nil || balanceAfter != 60 {
		t.Fatalf("expected balance 60, got %d, %v", balanceAfter, err)
	}
}

const (
	testTenantID  = "11111111-1111-1111-1111-111111111111"
	testInvoiceID = "22222222-2222-2222-2222-222222222222"
)

// newTestRepo builds the tables the refund path uses in a throwaway schema.
// It needs Postgres: set LEDGER_TEST_DATABASE_URL (CI does), otherwise the test is skipped.
func newTestRepo(t *testing.T) *PostgresRepo {
	t.Helper()
	databaseURL := os.Getenv("LEDGER_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("LEDGER_TEST_DATABASE_URL is not set")
	}
	admin, err := sql.Open("pgx", postgresDSN(databaseURL))
	if err != nil {
		t.Fatal(err)
	}
	schema := fmt.Sprintf("ledger_test_%d", time.Now().UnixNano())
	if _, err := admin.Exec("CREATE SCHEMA " + schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec("DROP SCHEMA " + schema + " CASCADE")
		_ = admin.Close()
	})
	for _, statement := range []string{
		"CREATE TABLE " + schema + ".invoices (id uuid PRIMARY KEY, tenant_id uuid NOT NULL)",
		"CREATE TABLE " + schema + `.ledger_entries (id uuid PRIMARY KEY, tenant_id uuid NOT NULL,
			invoice_id uuid NOT NULL REFERENCES ` + schema + `.invoices(id), kind varchar(16) NOT NULL,
			amount_cents integer NOT NULL, balance_after integer NOT NULL)`,
		"INSERT INTO " + schema + ".invoices VALUES ('" + testInvoiceID + "', '" + testTenantID + "')",
		"INSERT INTO " + schema + ".ledger_entries VALUES (gen_random_uuid(), '" + testTenantID + "', '" +
			testInvoiceID + "', 'charge', 100, 100)",
	} {
		if _, err := admin.Exec(statement); err != nil {
			t.Fatalf("prepare schema: %v", err)
		}
	}
	separator := "?"
	if strings.Contains(databaseURL, "?") {
		separator = "&"
	}
	repo, err := NewPostgresRepo(databaseURL + separator + "search_path=" + schema)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repo.db.Close() })
	return repo
}

func refundTotal(t *testing.T, repo *PostgresRepo) int64 {
	t.Helper()
	var total int64
	err := repo.db.QueryRow(
		"SELECT COALESCE(SUM(amount_cents), 0) FROM ledger_entries WHERE invoice_id = $1 AND kind = 'refund'",
		testInvoiceID,
	).Scan(&total)
	if err != nil {
		t.Fatal(err)
	}
	return total
}

// Regression for PT-002: this used to assert that two concurrent full refunds both succeed.
func TestConcurrentRefundsCannotDoubleSpend(t *testing.T) {
	repo := newTestRepo(t)
	service := NewServiceWithRepo("redis://localhost:6379/0", repo)
	const attempts = 10
	var waitGroup sync.WaitGroup
	errs := make(chan error, attempts)
	for range attempts {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			_, err := service.Refund(context.Background(), testInvoiceID, 100)
			errs <- err
		}()
	}
	waitGroup.Wait()
	close(errs)
	succeeded := 0
	for err := range errs {
		switch {
		case err == nil:
			succeeded++
		case !errors.Is(err, ErrInsufficientBalance):
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if succeeded != 1 {
		t.Fatalf("expected exactly one refund to succeed, got %d", succeeded)
	}
	if total := refundTotal(t, repo); total != 100 {
		t.Fatalf("expected 100 refunded in total, got %d", total)
	}
}

func TestSequentialRefundsStopAtChargedAmount(t *testing.T) {
	repo := newTestRepo(t)
	service := NewServiceWithRepo("redis://localhost:6379/0", repo)
	for _, step := range []struct {
		amount  int64
		balance int64
		err     error
	}{{60, 40, nil}, {40, 0, nil}, {1, 0, ErrInsufficientBalance}} {
		balanceAfter, err := service.Refund(context.Background(), testInvoiceID, step.amount)
		if !errors.Is(err, step.err) || balanceAfter != step.balance {
			t.Fatalf("refund %d: got %d, %v", step.amount, balanceAfter, err)
		}
	}
	_, err := service.Refund(context.Background(), "33333333-3333-3333-3333-333333333333", 1)
	if !errors.Is(err, ErrInvoiceNotFound) {
		t.Fatalf("expected ErrInvoiceNotFound, got %v", err)
	}
}
