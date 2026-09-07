package ledger

import (
	"context"
	"database/sql"
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

func (repo *PostgresRepo) CurrentBalance(ctx context.Context, invoiceID string) (int64, error) {
	var balance int64
	err := repo.db.QueryRowContext(
		ctx,
		"SELECT balance_after FROM ledger_entries WHERE invoice_id = $1 ORDER BY id DESC LIMIT 1",
		invoiceID,
	).Scan(&balance)
	if err != nil {
		return 0, fmt.Errorf("read invoice balance: %w", err)
	}
	return balance, nil
}

func (repo *PostgresRepo) InsertRefund(
	ctx context.Context,
	invoiceID string,
	amount int64,
	balanceAfter int64,
) error {
	_, err := repo.db.ExecContext(
		ctx,
		`INSERT INTO ledger_entries
			(id, tenant_id, invoice_id, kind, amount_cents, balance_after)
		 VALUES (gen_random_uuid(), (SELECT tenant_id FROM invoices WHERE id = $1),
			$1, 'refund', $2, $3)`,
		invoiceID,
		amount,
		balanceAfter,
	)
	if err != nil {
		return fmt.Errorf("insert refund: %w", err)
	}
	return nil
}
