import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { WEBHOOK_HMAC_KEY } from "../src/config";
import { dispatchWebhook } from "../src/lib/dispatch";

const webhook = {
  id: "demo",
  url: "http://partner.example/hook",
  events: ["payment.updated"],
};

function redirectTo(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

describe("webhook dispatch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("follows redirects to allowed hosts and signs the request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectTo("https://partner.example/v2/hook"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const payload = { event: "payment.updated" };
    const result = await dispatchWebhook(webhook, payload);
    const expectedSignature = createHmac("sha256", WEBHOOK_HMAC_KEY)
      .update(JSON.stringify(payload))
      .digest("hex");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://partner.example/v2/hook");
    expect(fetchMock.mock.calls[1][1].headers["X-Helios-Signature"]).toBe(expectedSignature);
    expect(fetchMock.mock.calls[1][1].redirect).toBe("manual");
    expect(result).toEqual({
      finalUrl: "https://partner.example/v2/hook",
      status: 200,
      bodySnippet: "ok",
    });
  });

  it.each([
    "http://169.254.169.254/latest/meta-data/iam/security-credentials/role",
    "http://metadata/computeMetadata/v1/",
    "http://localhost:8000/internal",
    "http://10.0.0.5/admin",
    "/../../hook?next=http://127.0.0.1/",
  ])("refuses to follow a redirect to %s", async (location) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirectTo(location))
      .mockResolvedValueOnce(new Response("secret", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(dispatchWebhook(webhook)).rejects.toThrow("webhook URL is not allowed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["file:///etc/passwd", "ftp://partner.example/hook", "gopher://partner.example/"])(
    "refuses to follow a redirect to non-http scheme %s",
    async (location) => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(redirectTo(location))
        .mockResolvedValueOnce(new Response("secret", { status: 200 }));
      vi.stubGlobal("fetch", fetchMock);

      await expect(dispatchWebhook(webhook)).rejects.toThrow("webhook URL scheme is not allowed");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("re-checks the stored URL at send time before making any request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("secret", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      dispatchWebhook({ ...webhook, url: "http://169.254.169.254/latest/meta-data/" }),
    ).rejects.toThrow("webhook URL is not allowed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops after the redirect limit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(redirectTo("https://partner.example/loop"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(dispatchWebhook(webhook)).rejects.toThrow("webhook redirect limit exceeded");
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });
});
