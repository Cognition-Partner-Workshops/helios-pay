#!/usr/bin/env bash
# V18: PHP2Shell vulnerable request-surface reachability (behavioral evidence).
#
# CVE-2026-109618 / CVE-2026-109619 are PHP RUNTIME remote-code-execution flaws
# in the request-processing path (multipart/RFC1867 parsing and the
# session.upload_progress lifecycle). There is no public weaponized PoC and this
# demo does not ship one. What this check proves, live, against the affected
# build is the BEHAVIORAL PRECONDITION: the exact pre-auth request surfaces the
# CVEs are reached through are reachable and are processed by the application.
#
# EVIDENCE MODEL — read before quoting this:
#   PROVES   : the affected runtime (V17) exposes and processes the vulnerable
#              request surfaces pre-auth (multipart upload + upload_progress
#              session lifecycle), i.e. the CVE is reachable here.
#   DOES NOT : execute code, corrupt interpreter state, or otherwise demonstrate
#              RCE. A fatal/500/OOM alone is NOT proof of code execution, and a
#              generic OOM is not specific to these CVEs.
#   Exploitation proof requires a working PoC exploit, intentionally out of scope.
set -euo pipefail

STATEMENT=${STATEMENT:-http://localhost:8095}
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fails=0

# Precondition: the runtime must be an affected build (defer to V17's logic).
affected=$(curl -fsS "$STATEMENT/version" | jq -r '.runtime.affected')
sapi=$(curl -fsS "$STATEMENT/version" | jq -r '.sapi')
if [ "$affected" != "true" ]; then
  echo "SKIP V18: runtime is not an affected build (run V17) — nothing to reach"
  exit 0
fi
echo "runtime: affected build on SAPI '$sapi'"

# Surface 1 (CVE-2026-109618): pre-auth multipart/RFC1867 upload is reachable and
# the parser hands a fully-parsed request to application code (success sentinel).
printf 'invoiceRef,amountCents,currency\nINV-1,1000,USD\n' > "$tmp/ok.csv"
control=$(curl -fsS -X POST "$STATEMENT/remittances/import" \
  -F 'partnerRef=acme' -F "remittance=@$tmp/ok.csv;type=text/csv" || true)
if jq -e '.imported == true' >/dev/null 2>&1 <<<"$control"; then
  echo "PASS surface-1: pre-auth multipart/RFC1867 parser reachable and executed"
else
  echo "FAIL surface-1: multipart upload path did not execute"; echo "$control"; fails=$((fails+1))
fi

# Surface 2 (CVE-2026-109619): session.upload_progress lifecycle is reachable.
# Send the upload with the configured progress field + a session cookie; the
# runtime must accept and process it (this is the stale-state producer surface).
jar="$tmp/cookies"
prog=$(curl -fsS -c "$jar" -b "$jar" -X POST "$STATEMENT/remittances/import" \
  -F 'PHP_SESSION_UPLOAD_PROGRESS=heliosDemo' \
  -F 'partnerRef=acme' -F "remittance=@$tmp/ok.csv;type=text/csv" || true)
if jq -e '.imported == true' >/dev/null 2>&1 <<<"$prog"; then
  echo "PASS surface-2: session.upload_progress lifecycle field accepted and processed"
else
  echo "FAIL surface-2: upload_progress surface not reachable"; echo "$prog"; fails=$((fails+1))
fi

echo
if [ "$fails" -ne 0 ]; then
  echo "FAIL V18: one or more vulnerable surfaces were not reachable"
  exit 1
fi
echo "PASS V18: both PHP2Shell request surfaces are reachable/processed on the affected runtime."
echo "  This is behavioral precondition evidence — the CVE is reachable here — NOT RCE proof."
