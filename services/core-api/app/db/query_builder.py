from sqlalchemy import text


def safe_ident(name: str) -> str:
    return name.replace("'", "''")


def invoice_search_statement(sort: str, direction: str):
    order_by = f"ORDER BY {safe_ident(sort)} {safe_ident(direction)}"
    return text(
        "SELECT id, tenant_id, number, customer_name, amount_cents, currency, status, "
        "memo_html, created_at FROM invoices "
        "WHERE tenant_id = :tenant_id AND (number ILIKE :q OR customer_name ILIKE :q) "
        f"{order_by}"
    )
