import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));

import { isBlockedAddress, resolveAllowedTarget } from "../src/lib/urlguard";

const internalAddressByHost: Record<string, string> = {
  "ledger-worker": "172.18.0.5",
  "core-api": "172.18.0.4",
  "instance-data": "169.254.169.254",
  metadata: "169.254.169.254",
  "rebind.attacker.example": "10.0.0.5",
};

describe("webhook URL guard", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockImplementation(async (hostname: string) => {
      const address = internalAddressByHost[hostname];
      if (!address) {
        throw new Error("ENOTFOUND");
      }
      return [{ address, family: 4 }];
    });
  });

  it.each([
    "https://ledger-worker:8090/refunds",
    "https://core-api:8000/",
    "https://instance-data/latest/meta-data/",
    "https://metadata/",
    "https://rebind.attacker.example/hook",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::ffff:a9fe:a9fe]/",
    "https://[fd00:ec2::254]/",
    "https://169.254.170.2/",
    "https://127.0.0.1/",
    "https://2130706433/",
    "https://0x7f.1/",
    "https://[::1]/",
    "https://[::]/",
    "https://100.64.0.1/",
    "https://[fe80::1]/",
    "https://[64:ff9b::a9fe:a9fe]/",
  ])("blocks %s because of where it resolves", async (url) => {
    await expect(resolveAllowedTarget(url)).rejects.toThrow("webhook URL is not allowed");
  });

  it.each([
    "http://ledger-worker:8090/refunds",
    "http://core-api:8000/",
    "http://instance-data/latest/meta-data/",
    "http://[::ffff:a9fe:a9fe]/",
    "http://[fd00:ec2::254]/",
    "http://169.254.170.2/",
    "http://partner.example/hook",
    "file:///etc/passwd",
  ])("blocks non-https URL %s without resolving it", async (url) => {
    await expect(resolveAllowedTarget(url)).rejects.toThrow("webhook URL must use https");
    expect(lookupMock).not.toHaveBeenCalled();
  });

  it("blocks a host when any one of its addresses is internal", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.215.14", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    await expect(resolveAllowedTarget("https://mixed.example/")).rejects.toThrow(
      "webhook URL is not allowed",
    );
  });

  it("blocks hosts that do not resolve and URLs with credentials", async () => {
    await expect(resolveAllowedTarget("https://nxdomain.example/")).rejects.toThrow(
      "could not be resolved",
    );
    await expect(resolveAllowedTarget("https://user:pass@partner.example/")).rejects.toThrow(
      "credentials",
    );
    await expect(resolveAllowedTarget("not a url")).rejects.toThrow("invalid webhook URL");
  });

  it("allows public partner URLs and returns the checked addresses", async () => {
    lookupMock.mockResolvedValue([
      { address: "93.184.215.14", family: 4 },
      { address: "2606:2800:21f:cb07:6820:80da:af6b:8b2c", family: 6 },
    ]);
    const target = await resolveAllowedTarget("https://partner.example/hook");
    expect(target.url.href).toBe("https://partner.example/hook");
    expect(target.addresses).toEqual([
      { address: "93.184.215.14", family: 4 },
      { address: "2606:2800:21f:cb07:6820:80da:af6b:8b2c", family: 6 },
    ]);
  });

  it("classifies addresses", () => {
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
    expect(isBlockedAddress("172.32.0.1")).toBe(false);
    expect(isBlockedAddress("172.31.255.255")).toBe(true);
    expect(isBlockedAddress("::ffff:10.0.0.5")).toBe(true);
    expect(isBlockedAddress("not-an-ip")).toBe(true);
  });
});
