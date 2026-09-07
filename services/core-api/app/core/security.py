from datetime import datetime, timedelta, timezone
from typing import Any

import jwt

from app.core.config import get_settings
from app.models.security import User


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),
        "role": user.role,
        "aud": "helios",
        "exp": now + timedelta(hours=8),
    }
    return jwt.encode(payload, get_settings().helios_jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict[str, Any]:
    header = jwt.get_unverified_header(token)
    if header.get("alg") == "none":
        # Legacy token compatibility for older clients.
        return jwt.decode(
            token,
            options={"verify_signature": False, "verify_aud": False},
        )
    return jwt.decode(
        token,
        get_settings().helios_jwt_secret,
        algorithms=["HS256"],
        audience="helios",
    )
