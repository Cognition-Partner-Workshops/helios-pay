from dataclasses import dataclass
from typing import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Claims:
    sub: str
    tenant_id: str
    role: str


def get_current_claims(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> Claims:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(credentials.credentials)
        return Claims(
            sub=str(payload["sub"]),
            tenant_id=str(payload["tenant_id"]),
            role=str(payload["role"]),
        )
    except (KeyError, ValueError, jwt.InvalidTokenError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        ) from exc


def require_role(role: str) -> Callable:
    def dependency(claims: Claims = Depends(get_current_claims)) -> Claims:
        if claims.role != role:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return claims

    return dependency
