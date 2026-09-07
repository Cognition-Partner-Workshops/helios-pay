#!/usr/bin/env bash
set -euo pipefail

CORE=${CORE:-http://localhost:8000}
TOKEN=$(curl -fsS "$CORE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"operator@acme.example","password":"Password123!"}' | jq -r '.access_token')

response=$(curl -fsS "$CORE/diagnostics/connectivity" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"host":"127.0.0.1; id"}')

if jq -e '.output | contains("uid=")' >/dev/null <<<"$response"; then
  echo "PASS V16: authenticated connectivity check executed injected id command: $(jq -r '.output' <<<"$response" | tr '\n' ' ')"
else
  echo "FAIL V16: injected id output was not returned"
  echo "$response"
  exit 1
fi
