import uuid
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.documents import Document
from app.services.storage import resolve_path

router = APIRouter(tags=["documents"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/invoices/{invoice_id}/documents")
def list_documents(invoice_id: uuid.UUID, db=Depends(get_db)):
    return db.scalars(select(Document).where(Document.invoice_id == invoice_id)).all()


@router.get("/documents/{document_id}/download")
def download_document(document_id: uuid.UUID, p: str = "", db=Depends(get_db)):
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    path = resolve_path(document.storage_path, p)
    return FileResponse(path, filename=document.filename, media_type=document.content_type)
