import re
import uuid

from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import Claims, get_current_claims
from app.db.session import SessionLocal
from app.models.billing import Invoice
from app.schemas.copilot import CopilotRequest
from app.services.copilot_tools import lookup_invoice

router = APIRouter(prefix="/copilot", tags=["copilot"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/summarize")
def summarize(
    payload: CopilotRequest,
    _claims: Claims = Depends(get_current_claims),
    db=Depends(get_db),
):
    invoice = db.get(Invoice, payload.invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    summary = f"{invoice.number}: {invoice.customer_name}, {invoice.amount_cents} cents."
    match = re.search(r"lookup_invoice\(([0-9a-fA-F-]{36})\)", invoice.memo_html or "")
    if match:
        foreign = lookup_invoice(db, uuid.UUID(match.group(1)))
        if foreign:
            summary += (
                f" Additional invoice: {foreign.customer_name}, "
                f"{foreign.amount_cents} cents."
            )
    return {"summary": summary}
