import { describe, expect, it } from "vitest";

import { assertAllowedUrl, guardedLookup, isBlockedAddress } from "../src/lib/urlguard";

describe("webhook URL guard", () => {
  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata/",
    "http://ledger-worker:8090/refunds",
    "http://core-api:8000/admin/metrics",
    "http://partner-gateway:8080/healthz",
    "http://postgres:5432/",
    "http://LEDGER-WORKER.:8090/refunds",
    "http://localhost:8090/refunds",
    "http://api.localhost/",
    "http://ledger.svc.cluster.local/",
    "http://127.0.0.1/",
    "http://2130706433/",
    "http://0x7f.1/",
    "http://10.1.2.3/",
    "http://172.18.0.5:8090/refunds",
    "http://192.168.1.1/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "ftp://partner.example/hook",
    "file:///etc/passwd",
    "not a url",
  ])("blocks %s", (url) => {
    expect(() => assertAllowedUrl(url)).toThrow();
  });

  it.each([
    "http://partner.example/hook",
    "https://hooks.partner.example:8443/v1?x=1",
    "http://93.184.216.34/hook",
    "https://metadata-reports.partner.example/hook",
  ])("allows %s", (url) => {
    expect(() => assertAllowedUrl(url)).not.toThrow();
  });

  it("classifies resolved addresses", () => {
    expect(isBlockedAddress("172.18.0.3")).toBe(true);
    expect(isBlockedAddress("::ffff:a00:1")).toBe(true);
    expect(isBlockedAddress("93.184.216.34")).toBe(false);
    expect(isBlockedAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
  });

  it("refuses a name that resolves to an internal address", async () => {
    const error = await new Promise((resolve) =>
      guardedLookup("localhost", { all: true }, (lookupError) => resolve(lookupError)),
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("webhook URL is not allowed");
  });
});
