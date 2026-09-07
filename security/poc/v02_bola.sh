#!/usr/bin/env bash
set -euo pipefail

CORE=${CORE:-http://localhost:8000}
login() {
  curl -fsS "$CORE/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"Password123!\"}" | jq -r '.access_token'
}

acme_token=$(login viewer@acme.example)
globex_token=$(login viewer@globex.example)
foreign=$(curl -fsS "$CORE/invoices" -H "Authorization: Bearer $globex_token" | jq -c '.[0]')
foreign_id=$(jq -r '.id' <<<"$foreign")
foreign_customer=$(jq -r '.customer_name' <<<"$foreign")

body=$(mktemp)
trap 'rm -f "$body"' EXIT
status=$(curl -sS -o "$body" -w '%{http_code}' "$CORE/invoices/export?invoice_id=$foreign_id" \
  -H "Authorization: Bearer $acme_token")
if [[ "$status" == "200" ]] && grep -q "$foreign_customer" "$body"; then
  echo "PASS V02: Acme viewer exported Globex invoice $foreign_id ($foreign_customer)"
else
  echo "FAIL V02: cross-tenant export was not returned"
  cat "$body"
  exit 1
fi
