#!/usr/bin/env bash
set -euo pipefail

if git log -p -- infra/terraform/secrets.auto.tfvars | grep -q 'helios_prod_'; then
  echo "PASS V11: removed Terraform secret is recoverable from git history"
else
  echo "FAIL V11: expected secret was not found in git history"
  exit 1
fi
if grep -q 'helios_whk_live_3f9ac2b17e5d4c8a9f0b6d2e1a7c4f8e' \
  services/partner-gateway/src/config.ts; then
  echo "PASS V11: gateway HMAC key is present in source"
else
  echo "FAIL V11: gateway HMAC key was not found"
  exit 1
fi
