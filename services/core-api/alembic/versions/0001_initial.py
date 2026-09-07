"""create the shared Helios Pay schema"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    uuid = postgresql.UUID(as_uuid=True)
    op.create_table(
        "tenants",
        sa.Column("id", uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
    )
    op.create_table(
        "users",
        sa.Column("id", uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", uuid, sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(32), nullable=False),
    )
    op.create_table(
        "invoices",
        sa.Column("id", uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", uuid, sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("number", sa.String(64), nullable=False),
        sa.Column("customer_name", sa.String(255), nullable=False),
        sa.Column("amount_cents", sa.Integer, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("memo_html", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_table(
        "documents",
        sa.Column("id", uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", uuid, sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("invoice_id", uuid, sa.ForeignKey("invoices.id"), nullable=False, index=True),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("storage_path", sa.String(1024), nullable=False),
        sa.Column("content_type", sa.String(120), nullable=False),
    )
    op.create_table(
        "payments",
        sa.Column("id", uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", uuid, sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("invoice_id", uuid, sa.ForeignKey("invoices.id"), nullable=False, index=True),
        sa.Column("amount_cents", sa.Integer, nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
    )
    op.create_table(
        "ledger_entries",
        sa.Column("id", uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", uuid, sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("invoice_id", uuid, sa.ForeignKey("invoices.id"), nullable=False, index=True),
        sa.Column("kind", sa.String(16), nullable=False),
        sa.Column("amount_cents", sa.Integer, nullable=False),
        sa.Column("balance_after", sa.Integer, nullable=False),
    )
    op.create_table(
        "partner_webhooks",
        sa.Column("id", uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("tenant_id", uuid, sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("url", sa.String(1024), nullable=False),
        sa.Column("secret", sa.String(255), nullable=False),
        sa.Column("events", postgresql.JSONB, nullable=False, server_default="[]"),
    )
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", uuid, sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("token", sa.String(255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean, nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    for table in (
        "password_reset_tokens",
        "partner_webhooks",
        "ledger_entries",
        "payments",
        "documents",
        "invoices",
        "users",
        "tenants",
    ):
        op.drop_table(table)
