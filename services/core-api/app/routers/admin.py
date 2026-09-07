from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.billing import Invoice
from app.models.tenant import Tenant

router = APIRouter(prefix="/admin", tags=["admin"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/metrics")
def metrics(db=Depends(get_db)):
    tenants = db.scalars(select(Tenant).order_by(Tenant.slug)).all()
    counts = {
        tenant.slug: db.scalar(
            select(func.count()).select_from(Invoice).where(Invoice.tenant_id == tenant.id)
        )
        for tenant in tenants
    }
    settings = get_settings()
    return {
        "tenants": [{"id": str(tenant.id), "slug": tenant.slug} for tenant in tenants],
        "invoice_counts": counts,
        "config": {"llm_mode": settings.helios_llm_mode, "core_api_url": settings.core_api_url},
    }
