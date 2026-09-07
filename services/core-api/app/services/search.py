from sqlalchemy.orm import Session

from app.core.deps import Claims
from app.db.query_builder import invoice_search_statement
from app.schemas.invoice import InvoiceSearch


def search_invoices(db: Session, search: InvoiceSearch, claims: Claims):
    statement = invoice_search_statement(search.sort, search.direction)
    return db.execute(
        statement,
        {"tenant_id": claims.tenant_id, "q": f"%{search.q}%"},
    ).mappings().all()
