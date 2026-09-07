#!/usr/bin/env bash
set -euo pipefail

CORE=${CORE:-http://localhost:8000}
TOKEN=$(curl -fsS "$CORE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@acme.example","password":"Password123!"}' | jq -r '.access_token')

error_body=$(mktemp)
trap 'rm -f "$error_body"' EXIT
curl -sS -G "$CORE/invoices" -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'sort=missing_column' >"$error_body" || true

if grep -Eqi 'missing_column|undefined column|ProgrammingError' "$error_body"; then
  echo "PASS V01: invalid ORDER BY identifier exposed a database error"
else
  echo "FAIL V01: expected a raw database error"
  cat "$error_body"
  exit 1
fi

ordered=$(curl -fsS -G "$CORE/invoices" -H "Authorization: Bearer $TOKEN" \
  --data-urlencode 'sort=CASE WHEN 1=1 THEN amount_cents ELSE -amount_cents END' \
  --data-urlencode 'direction=DESC')
if jq -e 'type == "array" and length > 0' >/dev/null <<<"$ordered"; then
  echo "PASS V01: boolean ORDER BY expression was accepted and returned reordered rows"
else
  echo "FAIL V01: injectable ORDER BY expression was rejected"
  exit 1
fi
