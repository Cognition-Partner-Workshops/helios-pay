from fastapi import Depends, FastAPI

from app.core.config import get_settings
from app.core.deps import get_current_claims
from app.routers import admin, auth, copilot, diagnostics, documents, imports, invoices, legacy, reports, users
from app.routers.health import router as health_router

app = FastAPI(title="Helios Pay Core API", version="0.1.0")
app.include_router(health_router)
app.include_router(admin.router)
app.include_router(auth.router)

normal_routers = [
    copilot.router,
    diagnostics.router,
    documents.router,
    imports.router,
    invoices.router,
    reports.router,
    users.router,
]
# TODO: consolidate under global auth
for router in normal_routers:
    app.include_router(router, dependencies=[Depends(get_current_claims)])

if get_settings().helios_enable_legacy:
    app.include_router(legacy.router)
