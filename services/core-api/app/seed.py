import uuid
import bcrypt
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models import Document, Invoice, LedgerEntry, Tenant, User

TENANTS = (("Acme Corporation", "acme"), ("Globex Corporation", "globex"), ("Initech", "initech"))
ROLES = ("admin", "operator", "viewer")


def stable_id(kind: str, value: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"https://helios.example/{kind}/{value}")


def seed() -> None:
    with SessionLocal.begin() as db:
        tenants: dict[str, Tenant] = {}
        for name, slug in TENANTS:
            tenant = db.scalar(select(Tenant).where(Tenant.slug == slug))
            if tenant is None:
                tenant = Tenant(id=stable_id("tenant", slug), name=name, slug=slug)
                db.add(tenant)
                db.flush()
            tenants[slug] = tenant
        password_hash = bcrypt.hashpw(b"Password123!", bcrypt.gensalt()).decode()
        for slug, tenant in tenants.items():
            for role in ROLES:
                email = f"{role}@{slug}.example"
                if db.scalar(select(User).where(User.email == email)) is None:
                    db.add(User(id=stable_id("user", email), tenant_id=tenant.id, email=email, password_hash=password_hash, role=role))
        for index in range(201):
            slug = TENANTS[index % len(TENANTS)][1]
            tenant = tenants[slug]
            number = f"INV-{index + 1:05d}"
            invoice = db.scalar(select(Invoice).where(Invoice.number == number))
            if invoice is None:
                invoice = Invoice(
                    id=stable_id("invoice", number),
                    tenant_id=tenant.id,
                    number=number,
                    customer_name=f"{slug.title()} Customer {index + 1}",
                    amount_cents=12500 + ((index * 731) % 850000),
                    currency="USD",
                    status=("paid", "open", "overdue")[index % 3],
                    memo_html=f"Invoice {number} for {slug.title()}.",
                )
                db.add(invoice)
                db.flush()
                if index % 10 == 0:
                    db.add(Document(id=stable_id("document", number), tenant_id=tenant.id, invoice_id=invoice.id, filename=f"{number}.pdf", storage_path=f"uploads/{slug}/{number}.pdf", content_type="application/pdf"))
                    db.add(LedgerEntry(id=stable_id("ledger", number), tenant_id=tenant.id, invoice_id=invoice.id, kind="charge", amount_cents=invoice.amount_cents, balance_after=invoice.amount_cents))
    print("Seed complete: 3 tenants, 9 users, 201 invoices")


if __name__ == "__main__":
    seed()
