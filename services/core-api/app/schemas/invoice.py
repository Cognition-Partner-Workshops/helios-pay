from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

InvoiceSortColumn = Literal[
    "id", "number", "customer_name", "amount_cents", "currency", "status", "created_at"
]


class InvoiceSearch(BaseModel):
    q: str = ""
    sort: InvoiceSortColumn = "created_at"
    direction: Literal["ASC", "DESC"] = "DESC"


class InvoiceCreate(BaseModel):
    number: str
    customer_name: str
    amount_cents: int = Field(gt=0)
    currency: str = "USD"
    status: str = "open"
    memo_html: str | None = None


class InvoiceReference(BaseModel):
    invoice_id: UUID
