#!/usr/bin/env bash
set -euo pipefail

CORE=${CORE:-http://localhost:8000}
body=$(mktemp)
trap 'rm -f "$body"' EXIT
status=$(curl -sS -o "$body" -w '%{http_code}' "$CORE/admin/metrics")
if [[ "$status" == "200" ]] && jq -e '.tenants | length > 0' "$body" >/dev/null; then
  echo "PASS V05: unauthenticated /admin/metrics returned HTTP 200"
else
  echo "FAIL V05: admin metrics was not unauthenticated"
  cat "$body"
  exit 1
fi
