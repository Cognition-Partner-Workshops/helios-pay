import pytest

from tests.test_vulnerabilities import auth_header


@pytest.mark.parametrize(
    "params",
    [
        {"sort": "(SELECT 1)"},
        {"sort": "(SELECT CAST(password_hash AS int) FROM users LIMIT 1)"},
        {"sort": "missing_column"},
        {"sort": "CASE WHEN 1=1 THEN amount_cents ELSE -amount_cents END"},
        {"direction": "DESC LIMIT 1"},
        {"direction": "DESC, (SELECT 1)"},
        {"direction": "desc"},
    ],
)
def test_invoice_search_rejects_sql_in_sort_and_direction(client, tenant_a_token, params):
    response = client.get("/invoices", params=params, headers=auth_header(tenant_a_token))
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)


def test_invoice_search_sorts_by_allowed_column(client, tenant_a_token):
    response = client.get(
        "/invoices",
        params={"sort": "amount_cents", "direction": "ASC"},
        headers=auth_header(tenant_a_token),
    )
    assert response.status_code == 200
    amounts = [row["amount_cents"] for row in response.json()]
    assert amounts and amounts == sorted(amounts)

    response = client.get(
        "/invoices",
        params={"sort": "amount_cents", "direction": "DESC"},
        headers=auth_header(tenant_a_token),
    )
    assert response.status_code == 200
    assert [row["amount_cents"] for row in response.json()] == sorted(amounts, reverse=True)


def test_invoice_search_stays_in_tenant(client, tenant_a_token):
    response = client.get("/invoices", headers=auth_header(tenant_a_token))
    assert response.status_code == 200
    assert {row["tenant_id"] for row in response.json()} == {"00000000-0000-0000-0000-0000000000a1"}
