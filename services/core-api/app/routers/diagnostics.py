import subprocess

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.deps import Claims, get_current_claims

router = APIRouter(prefix="/diagnostics", tags=["diagnostics"])


class ConnectivityRequest(BaseModel):
    host: str


@router.post("/connectivity")
def check_connectivity(
    payload: ConnectivityRequest,
    claims: Claims = Depends(get_current_claims),
):
    # Check partner host reachability before webhook dispatch.
    command = f"getent hosts {payload.host}"
    result = subprocess.run(
        command,
        shell=True,
        capture_output=True,
        text=True,
        timeout=5,
    )
    return {
        "host": payload.host,
        "exit_code": result.returncode,
        "output": result.stdout + result.stderr,
    }
