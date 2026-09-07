#!/usr/bin/env bash
set -euo pipefail

# V11 has two sub-beats. The git-history recovery sub-beat needs an
# add-then-remove commit history that does not exist in this repo: helios-pay
# was migrated from helios-pay-demo as a fresh import, so there is no history to
# recover the removed Terraform secret from. It is reported N/A here (see
# demo/WALKTHROUGH.md). The checked-in HMAC literal sub-beat is fully
# demonstrable and is the one to show in this repo.

if git log -p -- infra/terraform/secrets.auto.tfvars 2>/dev/null | grep -q 'helios_prod_'; then
  echo "PASS V11: removed Terraform secret is recoverable from git history"
else
  echo "N/A  V11: git-history recovery unavailable in this migrated repo (no add-then-remove history)"
fi
if grep -q 'helios_whk_live_3f9ac2b17e5d4c8a9f0b6d2e1a7c4f8e' \
  services/partner-gateway/src/config.ts; then
  echo "PASS V11: gateway HMAC key is hardcoded in source"
else
  echo "FAIL V11: gateway HMAC key was not found"
  exit 1
fi
