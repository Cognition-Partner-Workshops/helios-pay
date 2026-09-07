from uuid import UUID

from pydantic import BaseModel


class UserUpdate(BaseModel):
    email: str | None = None
    role: str | None = None
    tenant_id: UUID | None = None
