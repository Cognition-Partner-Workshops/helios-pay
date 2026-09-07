from uuid import UUID

from pydantic import BaseModel, Field


class InvoiceSearch(BaseModel):
    q: str = ""
    sort: str = "created_at"
    direction: str = "DESC"


class InvoiceCreate(BaseModel):
    number: str
    customer_name: str
    amount_cents: int = Field(gt=0)
    currency: str = "USD"
    status: str = "open"
    memo_html: str | None = None


class InvoiceReference(BaseModel):
    invoice_id: UUID
