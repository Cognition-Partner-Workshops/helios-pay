import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { WEBHOOK_HMAC_KEY: "unit-test-webhook-key" },
  },
});
