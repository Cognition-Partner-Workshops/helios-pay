package ledger

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"
)

// Runs only when LEDGER_TEST_DATABASE_URL points at a Postgres database with
// the tenants, invoices and ledger_entries tables.
func TestPostgresRepoApplyRefundConcurrent(t *testing.T) {
	databaseURL := os.Getenv("LEDGER_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("LEDGER_TEST_DATABASE_URL not set")
	}
	repo, err := NewPostgresRepo(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()

	var tenantID, invoiceID string
	if err := repo.db.QueryRowContext(ctx, "INSERT INTO tenants (id) VALUES (gen_random_uuid()) RETURNING id").Scan(&tenantID); err != nil {
		t.Fatal(err)
	}
	if err := repo.db.QueryRowContext(ctx,
		"INSERT INTO invoices (id, tenant_id, amount_cents) VALUES (gen_random_uuid(), $1, 1000) RETURNING id",
		tenantID,
	).Scan(&invoiceID); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.db.ExecContext(ctx,
		`INSERT INTO ledger_entries (tenant_id, invoice_id, kind, amount_cents, balance_after)
		 VALUES ($1, $2, 'charge', 1000, 1000)`,
		tenantID, invoiceID,
	); err != nil {
		t.Fatal(err)
	}

	const workers = 8
	var waitGroup sync.WaitGroup
	errs := make(chan error, workers)
	for range workers {
		waitGroup.Add(1)
		go func() {
			defer waitGroup.Done()
			_, err := repo.ApplyRefund(ctx, invoiceID, 1000)
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
	if successes != 1 || insufficient != workers-1 {
		t.Fatalf("expected exactly one refund to succeed, got %d successes and %d insufficient-balance errors", successes, insufficient)
	}

	var refunds int
	var remaining int64
	if err := repo.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FILTER (WHERE kind = 'refund'),
		        COALESCE(SUM(CASE kind WHEN 'refund' THEN -amount_cents ELSE amount_cents END), 0)
		 FROM ledger_entries WHERE invoice_id = $1`,
		invoiceID,
	).Scan(&refunds, &remaining); err != nil {
		t.Fatal(err)
	}
	if refunds != 1 || remaining != 0 {
		t.Fatalf("expected one refund row and zero remaining balance, got %d rows and %d remaining", refunds, remaining)
	}

	if _, err := repo.ApplyRefund(ctx, invoiceID, 1); !errors.Is(err, ErrInsufficientBalance) {
		t.Fatalf("expected ErrInsufficientBalance on drained invoice, got %v", err)
	}
	if _, err := repo.ApplyRefund(ctx, "00000000-0000-0000-0000-000000000000", 1); !errors.Is(err, ErrInvoiceNotFound) {
		t.Fatalf("expected ErrInvoiceNotFound, got %v", err)
	}
}
