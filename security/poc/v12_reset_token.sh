#!/usr/bin/env bash
set -euo pipefail

CORE=${CORE:-http://localhost:8000}
started=$(date +%s)
response=$(curl -fsS "$CORE/auth/password-reset/request" \
  -H 'Content-Type: application/json' \
  -d '{"email":"viewer@acme.example"}')
token=$(jq -r '.token' <<<"$response")
if [[ -z "$token" || "$token" == "null" ]]; then
  echo "FAIL V12: reset endpoint did not return a token"
  exit 1
fi

if python3 - "$started" "$token" <<'PY'
import random
import string
import sys

started = int(sys.argv[1])
expected = sys.argv[2]
alphabet = string.ascii_letters + string.digits
for seed in range(started - 3, int(__import__("time").time()) + 4):
    random.seed(seed)
    candidate = "".join(random.choice(alphabet) for _ in range(32))
    if candidate == expected:
        raise SystemExit(0)
raise SystemExit(1)
PY
then
  echo "PASS V12: reset token reproduced from the approximate request timestamp"
else
  echo "FAIL V12: token was not reproducible in the time window"
  exit 1
fi
