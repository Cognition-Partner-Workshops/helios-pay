package ledger

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type PostgresRepo struct {
	db *sql.DB
}

func NewPostgresRepo(databaseURL string) (*PostgresRepo, error) {
	db, err := sql.Open("pgx", postgresDSN(databaseURL))
	if err != nil {
		return nil, err
	}
	return &PostgresRepo{db: db}, nil
}

// ApplyRefund checks the invoice balance and records the refund in one
// transaction. The invoice row is locked first so concurrent refunds for the
// same invoice serialize and the second one sees the first one's entry.
func (repo *PostgresRepo) ApplyRefund(ctx context.Context, invoiceID string, amount int64) (int64, error) {
	tx, err := repo.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin refund: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var tenantID string
	err = tx.QueryRowContext(
		ctx,
		"SELECT tenant_id FROM invoices WHERE id = $1 FOR UPDATE",
		invoiceID,
	).Scan(&tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrInvoiceNotFound
	}
	if err != nil {
		return 0, fmt.Errorf("lock invoice: %w", err)
	}

	var balance int64
	err = tx.QueryRowContext(
		ctx,
		`SELECT COALESCE(SUM(CASE kind WHEN 'refund' THEN -amount_cents ELSE amount_cents END), 0)
		 FROM ledger_entries WHERE invoice_id = $1`,
		invoiceID,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("read invoice balance: %w", err)
	}
	if balance < amount {
		return 0, ErrInsufficientBalance
	}

	balanceAfter := balance - amount
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO ledger_entries
			(id, tenant_id, invoice_id, kind, amount_cents, balance_after)
		 VALUES (gen_random_uuid(), $1, $2, 'refund', $3, $4)`,
		tenantID,
		invoiceID,
		amount,
		balanceAfter,
	)
	if err != nil {
		return 0, fmt.Errorf("insert refund: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit refund: %w", err)
	}
	return balanceAfter, nil
}
