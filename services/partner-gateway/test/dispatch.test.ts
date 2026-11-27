import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const lookupMock = vi.hoisted(() => vi.fn());
const httpsRequestMock = vi.hoisted(() => vi.fn());
const postJsonMock = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));
vi.mock("node:https", () => ({ request: httpsRequestMock }));
vi.mock("../src/lib/transport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/transport")>()),
  postJson: postJsonMock,
}));

import { WEBHOOK_HMAC_KEY } from "../src/config";
import { dispatchWebhook } from "../src/lib/dispatch";
import { pinnedLookup } from "../src/lib/transport";
import { UrlNotAllowedError } from "../src/lib/urlguard";

const publicAddress = { address: "93.184.215.14", family: 4 };
const webhook = { id: "demo", url: "https://partner.example/hook", events: ["payment.updated"] };

describe("webhook dispatch", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    httpsRequestMock.mockReset();
    postJsonMock.mockReset();
  });

  it("signs the request and sends it to the checked addresses", async () => {
    lookupMock.mockResolvedValue([publicAddress]);
    postJsonMock.mockResolvedValue({ status: 200, location: null, body: "ok" });

    const payload = { event: "payment.updated" };
    const result = await dispatchWebhook(webhook, payload);
    const expectedSignature = createHmac("sha256", WEBHOOK_HMAC_KEY)
      .update(JSON.stringify(payload))
      .digest("hex");

    expect(postJsonMock).toHaveBeenCalledTimes(1);
    const [target, body, headers] = postJsonMock.mock.calls[0];
    expect(target.addresses).toEqual([publicAddress]);
    expect(body).toBe(JSON.stringify(payload));
    expect(headers["X-Helios-Signature"]).toBe(expectedSignature);
    expect(result).toEqual({ finalUrl: webhook.url, status: 200, bodySnippet: "ok" });
  });

  it("fails before opening a connection when the host resolves to 10.0.0.5", async () => {
    postJsonMock.mockImplementation(
      (await vi.importActual<typeof import("../src/lib/transport")>("../src/lib/transport"))
        .postJson,
    );
    lookupMock.mockResolvedValue([{ address: "10.0.0.5", family: 4 }]);

    await expect(dispatchWebhook(webhook, {})).rejects.toBeInstanceOf(UrlNotAllowedError);
    expect(httpsRequestMock).not.toHaveBeenCalled();
  });

  it("re-checks the host at send time, after it passed at registration", async () => {
    lookupMock
      .mockResolvedValueOnce([publicAddress])
      .mockResolvedValueOnce([{ address: "172.18.0.5", family: 4 }]);
    postJsonMock.mockResolvedValue({ status: 200, location: null, body: "ok" });

    await dispatchWebhook(webhook, {});
    await expect(dispatchWebhook(webhook, {})).rejects.toBeInstanceOf(UrlNotAllowedError);
    expect(postJsonMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    "http://169.254.169.254/latest/meta-data/",
    "https://169.254.169.254/latest/meta-data/",
    "https://metadata/latest/meta-data/iam/",
    "http://ledger-worker:8090/refunds",
  ])("refuses to follow a redirect to %s", async (location) => {
    lookupMock.mockImplementation(async (hostname: string) =>
      hostname === "partner.example" ? [publicAddress] : [{ address: "172.18.0.9", family: 4 }],
    );
    postJsonMock.mockResolvedValue({ status: 302, location, body: "" });

    await expect(dispatchWebhook(webhook, {})).rejects.toBeInstanceOf(UrlNotAllowedError);
    expect(postJsonMock).toHaveBeenCalledTimes(1);
  });

  it("follows a redirect to another public https host", async () => {
    lookupMock.mockResolvedValue([publicAddress]);
    postJsonMock
      .mockResolvedValueOnce({ status: 307, location: "https://other.example/next", body: "" })
      .mockResolvedValueOnce({ status: 200, location: null, body: "done" });

    const result = await dispatchWebhook(webhook, {});
    expect(result).toEqual({
      finalUrl: "https://other.example/next",
      status: 200,
      bodySnippet: "done",
    });
  });
});

describe("pinned transport", () => {
  it("answers lookups with the checked addresses only", () => {
    const addresses = [{ address: "93.184.215.14", family: 4 as const }];
    const pinned = pinnedLookup(addresses);
    const allCallback = vi.fn();
    pinned("rebind.attacker.example", { all: true }, allCallback);
    expect(allCallback).toHaveBeenCalledWith(null, addresses);
    const singleCallback = vi.fn();
    pinned("rebind.attacker.example", {}, singleCallback);
    expect(singleCallback).toHaveBeenCalledWith(null, "93.184.215.14", 4);
  });

  it("passes the pinned lookup to https.request", async () => {
    httpsRequestMock.mockReturnValue({ on: vi.fn(), end: vi.fn() });
    const actualTransport =
      await vi.importActual<typeof import("../src/lib/transport")>("../src/lib/transport");
    const addresses = [{ address: "93.184.215.14", family: 4 as const }];
    void actualTransport.postJson(
      { url: new URL("https://partner.example/hook"), addresses },
      "{}",
      {},
    );

    expect(httpsRequestMock).toHaveBeenCalledTimes(1);
    const requestOptions = httpsRequestMock.mock.calls[0][1];
    expect(requestOptions.agent).toBe(false);
    const callback = vi.fn();
    requestOptions.lookup("partner.example", { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, addresses);
  });
});
