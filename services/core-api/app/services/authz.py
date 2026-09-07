from fastapi import HTTPException, status

from app.core.deps import Claims


def require_tenant(resource: object, claims: Claims) -> None:
    if str(resource.tenant_id) != claims.tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant access denied")
