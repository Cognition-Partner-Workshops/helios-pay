#!/usr/bin/env bash
set -euo pipefail

CORE=${CORE:-http://localhost:8000}
TOKEN=$(curl -fsS "$CORE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@acme.example","password":"Password123!"}' | jq -r '.access_token')
user=$(curl -fsS "$CORE/users/me" -H "Authorization: Bearer $TOKEN")
user_id=$(jq -r '.id' <<<"$user")
updated=$(curl -fsS -X PATCH "$CORE/users/$user_id" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"role":"admin"}')
if [[ "$(jq -r '.role' <<<"$updated")" == "admin" ]]; then
  echo "PASS V14: viewer self-updated role to admin through mass assignment"
else
  echo "FAIL V14: role was not escalated"
  echo "$updated"
  exit 1
fi
