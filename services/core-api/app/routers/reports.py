from fastapi import APIRouter, Depends
from sqlalchemy import text

from app.core.deps import Claims, get_current_claims
from app.db.session import SessionLocal
from app.services.exportsvc import export_file, secure_name

router = APIRouter(prefix="/reports", tags=["reports"])
REPORT_COLUMNS = {"invoice_count": "count(i.id)", "total_cents": "coalesce(sum(i.amount_cents), 0)"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/summary")
def report_summary(
    metric: str = "invoice_count",
    customer: str = "",
    claims: Claims = Depends(get_current_claims),
    db=Depends(get_db),
):
    column = REPORT_COLUMNS.get(metric, REPORT_COLUMNS["invoice_count"])
    query = (
        "SELECT " + column + " AS value FROM invoices i "
        "WHERE i.tenant_id = :tenant_id AND i.customer_name ILIKE :customer"
    )
    result = db.execute(
        text(query),
        {"tenant_id": claims.tenant_id, "customer": f"%{customer}%"},
    ).scalar_one()
    filename = secure_name(customer)
    return {"value": result, "export_path": export_file(filename)}
