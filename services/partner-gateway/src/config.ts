function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`${name} must be set; partner-gateway will not start without it`);
  }
  return value;
}

export const WEBHOOK_HMAC_KEY = requireEnv("WEBHOOK_HMAC_KEY");
export const CORE_API_URL = process.env.CORE_API_URL ?? "http://core-api:8000";
export const LEDGER_URL = process.env.LEDGER_URL ?? "http://ledger-worker:8090";
export const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://partner-gateway:8080";
