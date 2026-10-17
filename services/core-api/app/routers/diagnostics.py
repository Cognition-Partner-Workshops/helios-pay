import re
import subprocess

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator

from app.core.deps import Claims, get_current_claims

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])

# RFC 1123 hostname: dot-separated labels of letters, digits and hyphens,
# no leading/trailing hyphen, max 253 chars. Also covers dotted IPv4.
_HOSTNAME_RE = re.compile(
    r"^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*"
    r"[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.?$"
)


class ConnectivityRequest(BaseModel):
    host: str

    @field_validator("host")
    @classmethod
    def validate_host(cls, value: str) -> str:
        value = value.strip()
        if not _HOSTNAME_RE.fullmatch(value):
            raise ValueError("host must be a valid hostname or IPv4 address")
        return value


@router.post("/connectivity")
def check_connectivity(
    payload: ConnectivityRequest,
    claims: Claims = Depends(get_current_claims),
):
    # Check partner host reachability before webhook dispatch.
    # Argument list (no shell) so the host is never parsed by /bin/sh.
    result = subprocess.run(
        ["getent", "hosts", payload.host],
        shell=False,
        capture_output=True,
        text=True,
        timeout=5,
    )
    return {
        "host": payload.host,
        "exit_code": result.returncode,
        "output": result.stdout + result.stderr,
    }
