import csv
import io
import uuid
from pathlib import Path
from zipfile import ZipFile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy.exc import SQLAlchemyError

from app.core.deps import Claims, get_current_claims, require_role
from app.db.session import SessionLocal
from app.models.billing import Invoice
from app.schemas.invoice import InvoiceCreate, InvoiceSearch
from app.services.authz import require_tenant
from app.services.search import search_invoices
from app.services.storage import extract_zip

router = APIRouter(prefix="/invoices", tags=["invoices"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def list_invoices(
    search: InvoiceSearch = Depends(),
    claims: Claims = Depends(get_current_claims),
    db=Depends(get_db),
):
    try:
        return search_invoices(db, search, claims)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/export")
def export_invoice(
    invoice_id: uuid.UUID,
    claims: Claims = Depends(get_current_claims),
    db=Depends(get_db),
):
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    require_tenant(invoice, claims)
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["id", "tenant_id", "number", "customer_name", "amount_cents", "status"])
    writer.writerow(
        [
            str(invoice.id),
            str(invoice.tenant_id),
            invoice.number,
            invoice.customer_name,
            invoice.amount_cents,
            invoice.status,
        ]
    )
    return PlainTextResponse(stream.getvalue(), media_type="text/csv")


@router.get("/{invoice_id}")
def get_invoice(invoice_id: uuid.UUID, claims: Claims = Depends(get_current_claims), db=Depends(get_db)):
    invoice = db.get(Invoice, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    require_tenant(invoice, claims)
    return invoice


@router.post("")
def create_invoice(
    payload: InvoiceCreate,
    claims: Claims = Depends(require_role("operator")),
    db=Depends(get_db),
):
    invoice = Invoice(tenant_id=uuid.UUID(claims.tenant_id), **payload.model_dump())
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


@router.post("/{invoice_id}/statements")
def upload_statement(
    invoice_id: uuid.UUID,
    file: UploadFile = File(...),
    _claims: Claims = Depends(require_role("operator")),
):
    with ZipFile(file.file) as archive:
        extracted = extract_zip(archive, base_dir=Path("uploads") / str(invoice_id))
    return {"invoice_id": str(invoice_id), "files": extracted}
