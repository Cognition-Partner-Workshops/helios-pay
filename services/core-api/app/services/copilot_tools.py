from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.billing import Invoice


def lookup_invoice(db: Session, invoice_id: UUID) -> Invoice | None:
    return db.scalar(select(Invoice).where(Invoice.id == invoice_id))
