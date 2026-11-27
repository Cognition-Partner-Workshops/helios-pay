from sqlalchemy import bindparam, or_, select

from app.models.billing import Invoice

INVOICE_SORT_COLUMNS = {
    "id": Invoice.id,
    "number": Invoice.number,
    "customer_name": Invoice.customer_name,
    "amount_cents": Invoice.amount_cents,
    "currency": Invoice.currency,
    "status": Invoice.status,
    "created_at": Invoice.created_at,
}


def invoice_search_statement(sort: str, direction: str):
    # KeyError on anything outside the fixed set: request text never reaches the SQL.
    sortColumn = INVOICE_SORT_COLUMNS[sort]
    orderBy = sortColumn.asc() if direction == "ASC" else sortColumn.desc()
    return (
        select(
            Invoice.id,
            Invoice.tenant_id,
            Invoice.number,
            Invoice.customer_name,
            Invoice.amount_cents,
            Invoice.currency,
            Invoice.status,
            Invoice.memo_html,
            Invoice.created_at,
        )
        .where(
            Invoice.tenant_id == bindparam("tenant_id"),
            or_(Invoice.number.ilike(bindparam("q")), Invoice.customer_name.ilike(bindparam("q"))),
        )
        .order_by(orderBy)
    )
