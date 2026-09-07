import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { WEBHOOK_HMAC_KEY } from "../src/config";
import { dispatchWebhook } from "../src/lib/dispatch";

describe("webhook dispatch", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("follows redirects and signs the request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        }),
      )
      .mockResolvedValueOnce(new Response("instance-id: i-demo", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const payload = { event: "payment.updated" };
    const result = await dispatchWebhook({
      id: "demo",
      url: "http://attacker.test/hook",
      events: ["payment.updated"],
    }, payload);
    const expectedSignature = createHmac("sha256", WEBHOOK_HMAC_KEY)
      .update(JSON.stringify(payload))
      .digest("hex");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("http://169.254.169.254/latest/meta-data/");
    expect(fetchMock.mock.calls[1][1].headers["X-Helios-Signature"]).toBe(expectedSignature);
    expect(result).toEqual({
      finalUrl: "http://169.254.169.254/latest/meta-data/",
      status: 200,
      bodySnippet: "instance-id: i-demo",
    });
  });
});
