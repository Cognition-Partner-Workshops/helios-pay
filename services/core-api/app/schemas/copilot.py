from uuid import UUID

from pydantic import BaseModel


class CopilotRequest(BaseModel):
    invoice_id: UUID
