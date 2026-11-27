#!/usr/bin/env bash
# V17: PHP2Shell (CVE-2026-109618, CVE-2026-109619) affected-version detection.
# Reads the live statement-service runtime version and compares it to the patched
# floor. This proves EXPOSURE (an affected build is running), not exploitation.
set -euo pipefail

STATEMENT=${STATEMENT:-http://localhost:8095}

report=$(curl -fsS "$STATEMENT/version")
version=$(jq -r '.runtime.phpVersion' <<<"$report")
floor=$(jq -r '.runtime.patchedFloor' <<<"$report")
affected=$(jq -r '.runtime.affected' <<<"$report")
sapi=$(jq -r '.sapi' <<<"$report")

if [ "$affected" = "true" ]; then
  echo "PASS V17: statement-service runs PHP $version ($sapi), below patched floor $floor — affected by CVE-2026-109618/109619"
  echo "$report"
else
  echo "FAIL V17: PHP $version is at/above patched floor $floor — not an affected build"
  echo "$report"
  exit 1
fi
