from fastapi import APIRouter

router = APIRouter(prefix="/legacy", tags=["legacy"])


@router.get("/debug")
def debug():
    return {"legacy": True, "message": "legacy diagnostics"}
