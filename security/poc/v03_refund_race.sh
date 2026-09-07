#!/usr/bin/env bash
set -euo pipefail

CORE=${CORE:-http://localhost:8000}
LEDGER=${LEDGER:-http://localhost:8090}
TOKEN=$(curl -fsS "$CORE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@acme.example","password":"Password123!"}' | jq -r '.access_token')
invoice=$(curl -fsS "$CORE/invoices?q=INV-00001" -H "Authorization: Bearer $TOKEN" | jq -c '.[0]')
invoice_id=$(jq -r '.id' <<<"$invoice")
amount=$(jq -r '.amount_cents' <<<"$invoice")

responses=$(mktemp)
trap 'rm -f "$responses"' EXIT
for _ in 1 2; do
  curl -sS -w '\t%{http_code}\n' "$LEDGER/refunds" \
    -H 'Content-Type: application/json' \
    -d "{\"invoice_id\":\"$invoice_id\",\"amount_cents\":$amount}" >>"$responses" &
done
wait

successes=$(awk -F '\t' '$2 == 200 { count += 1 } END { print count + 0 }' "$responses")
if [[ "$successes" == "2" ]]; then
  echo "PASS V03: two concurrent full-balance refunds both returned HTTP 200"
else
  echo "FAIL V03: expected two successful refunds"
  cat "$responses"
  exit 1
fi

if command -v docker >/dev/null && docker compose exec -T postgres \
  psql -U helios -d helios -Atc \
  "SELECT (SELECT amount_cents FROM ledger_entries WHERE invoice_id = '$invoice_id' AND kind = 'charge' LIMIT 1) - COALESCE(SUM(amount_cents) FILTER (WHERE kind = 'refund'), 0) FROM ledger_entries WHERE invoice_id = '$invoice_id';" |
  awk '$1 < 0 { found = 1 } END { exit !found }'; then
  echo "PASS V03: effective ledger balance is negative after the double spend"
else
  echo "INFO V03: both writes succeeded; query the ledger entries to observe the negative effective balance"
fi
