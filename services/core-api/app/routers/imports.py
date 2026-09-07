from fastapi import APIRouter, Depends, File, UploadFile

from app.core.deps import Claims, require_role
from app.db.session import SessionLocal
from app.services.bulk_import import load_bulk_import

router = APIRouter(prefix="/invoices", tags=["imports"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/bulk-import")
def bulk_import(
    file: UploadFile = File(...),
    _claims: Claims = Depends(require_role("operator")),
    db=Depends(get_db),
):
    return {"records": load_bulk_import(file.file.read(), db)}
