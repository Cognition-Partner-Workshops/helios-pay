import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { WEBHOOK_HMAC_KEY } from "../src/config";
import { dispatchWebhook } from "../src/lib/dispatch";
import { postJson } from "../src/lib/transport";

vi.mock("../src/lib/transport", () => ({ postJson: vi.fn() }));
const postJsonMock = vi.mocked(postJson);

const webhook = { id: "demo", url: "http://attacker.test/hook", events: ["payment.updated"] };
const redirectTo = (location: string) => ({ status: 302, location, bodySnippet: "" });

describe("webhook dispatch", () => {
  afterEach(() => postJsonMock.mockReset());

  it("follows redirects to allowed hosts and signs every request", async () => {
    postJsonMock
      .mockResolvedValueOnce(redirectTo("https://hooks.partner.example/v2"))
      .mockResolvedValueOnce({ status: 200, location: null, bodySnippet: "ok" });

    const payload = { event: "payment.updated" };
    const result = await dispatchWebhook(webhook, payload);
    const expectedSignature = createHmac("sha256", WEBHOOK_HMAC_KEY)
      .update(JSON.stringify(payload))
      .digest("hex");

    expect(postJsonMock).toHaveBeenCalledTimes(2);
    expect(postJsonMock.mock.calls[1][0]).toBe("https://hooks.partner.example/v2");
    expect(postJsonMock.mock.calls[1][1]["X-Helios-Signature"]).toBe(expectedSignature);
    expect(result).toEqual({
      finalUrl: "https://hooks.partner.example/v2",
      status: 200,
      bodySnippet: "ok",
    });
  });

  // Regression for PT-005: this used to assert that the redirect to the metadata address was followed.
  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "http://metadata/latest/meta-data/iam/",
    "http://ledger-worker:8090/refunds",
    "http://127.0.0.1:8090/refunds",
    "file:///etc/passwd",
  ])("does not follow a redirect to %s", async (location) => {
    postJsonMock.mockResolvedValueOnce(redirectTo(location));

    await expect(dispatchWebhook(webhook, {})).rejects.toThrow("webhook URL is not allowed");
    expect(postJsonMock).toHaveBeenCalledTimes(1);
  });

  it("does not send to a stored webhook whose URL is not allowed", async () => {
    await expect(
      dispatchWebhook({ ...webhook, url: "http://ledger-worker:8090/refunds" }, {}),
    ).rejects.toThrow("webhook URL is not allowed");
    expect(postJsonMock).not.toHaveBeenCalled();
  });
});
