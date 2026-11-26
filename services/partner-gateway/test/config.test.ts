import { afterEach, describe, expect, it, vi } from "vitest";

describe("webhook signing key configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("refuses to load when WEBHOOK_HMAC_KEY is unset", async () => {
    vi.stubEnv("WEBHOOK_HMAC_KEY", undefined);
    vi.resetModules();
    await expect(import("../src/config")).rejects.toThrow(/WEBHOOK_HMAC_KEY/);
  });

  it("refuses to load when WEBHOOK_HMAC_KEY is blank", async () => {
    vi.stubEnv("WEBHOOK_HMAC_KEY", "   ");
    vi.resetModules();
    await expect(import("../src/config")).rejects.toThrow(/WEBHOOK_HMAC_KEY/);
  });

  it("uses the key from the environment", async () => {
    vi.stubEnv("WEBHOOK_HMAC_KEY", "key-from-environment");
    vi.resetModules();
    const config = await import("../src/config");
    expect(config.WEBHOOK_HMAC_KEY).toBe("key-from-environment");
  });
});
