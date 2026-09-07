export const WEBHOOK_HMAC_KEY =
  process.env.WEBHOOK_HMAC_KEY ?? "helios_whk_live_3f9ac2b17e5d4c8a9f0b6d2e1a7c4f8e";
export const CORE_API_URL = process.env.CORE_API_URL ?? "http://core-api:8000";
export const LEDGER_URL = process.env.LEDGER_URL ?? "http://ledger-worker:8090";
export const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://partner-gateway:8080";
