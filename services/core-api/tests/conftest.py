import uuid

import bcrypt
import pytest
from fastapi.testclient import TestClient

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.main import app
from app.models import Invoice, Tenant, User

TEST_TENANT_A = uuid.UUID("00000000-0000-0000-0000-0000000000a1")
TEST_TENANT_B = uuid.UUID("00000000-0000-0000-0000-0000000000b1")
TEST_USER_A = uuid.UUID("00000000-0000-0000-0000-0000000000a2")
TEST_USER_B = uuid.UUID("00000000-0000-0000-0000-0000000000b2")
TEST_INVOICE_A = uuid.UUID("00000000-0000-0000-0000-0000000000a3")
TEST_INVOICE_B = uuid.UUID("00000000-0000-0000-0000-0000000000b3")


@pytest.fixture(scope="session", autouse=True)
def database():
    Base.metadata.create_all(engine)
    with SessionLocal.begin() as db:
        tenants = [
            db.get(Tenant, TEST_TENANT_A) or Tenant(id=TEST_TENANT_A),
            db.get(Tenant, TEST_TENANT_B) or Tenant(id=TEST_TENANT_B),
        ]
        tenants[0].name, tenants[0].slug = "Test Acme", "test-acme"
        tenants[1].name, tenants[1].slug = "Test Globex", "test-globex"
        db.add_all(tenants)
        db.flush()
        password_hash = bcrypt.hashpw(b"Password123!", bcrypt.gensalt()).decode()
        users = [
            db.get(User, TEST_USER_A) or User(id=TEST_USER_A),
            db.get(User, TEST_USER_B) or User(id=TEST_USER_B),
        ]
        users[0].tenant_id = TEST_TENANT_A
        users[0].email = "viewer@test-acme.example"
        users[0].password_hash = password_hash
        users[0].role = "viewer"
        users[1].tenant_id = TEST_TENANT_B
        users[1].email = "viewer@test-globex.example"
        users[1].password_hash = password_hash
        users[1].role = "viewer"
        db.add_all(users)
        db.flush()
        invoices = [
            db.get(Invoice, TEST_INVOICE_A) or Invoice(id=TEST_INVOICE_A),
            db.get(Invoice, TEST_INVOICE_B) or Invoice(id=TEST_INVOICE_B),
        ]
        invoices[0].tenant_id = TEST_TENANT_A
        invoices[0].number = "TEST-A-001"
        invoices[0].customer_name = "Test Acme Customer"
        invoices[0].amount_cents = 1100
        invoices[0].currency = "USD"
        invoices[0].status = "open"
        invoices[0].memo_html = "Normal memo"
        invoices[1].tenant_id = TEST_TENANT_B
        invoices[1].number = "TEST-B-001"
        invoices[1].customer_name = "Foreign Customer"
        invoices[1].amount_cents = 9900
        invoices[1].currency = "USD"
        invoices[1].status = "open"
        invoices[1].memo_html = "Normal memo"
        db.add_all(invoices)
    yield


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def tenant_a_token(client):
    response = client.post(
        "/auth/login",
        json={"email": "viewer@test-acme.example", "password": "Password123!"},
    )
    assert response.status_code == 200
    return response.json()["access_token"]
