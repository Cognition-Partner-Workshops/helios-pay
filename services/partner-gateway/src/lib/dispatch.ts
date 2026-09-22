import { createHmac } from "node:crypto";

import { WEBHOOK_HMAC_KEY } from "../config";
import { assertAllowedUrl } from "./urlguard";

const MAX_REDIRECTS = 5;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export interface Webhook {
  id: string;
  url: string;
  events: string[];
}

export interface DispatchResult {
  finalUrl: string;
  status: number;
  bodySnippet: string;
}

function assertDispatchableUrl(rawUrl: string): void {
  assertAllowedUrl(rawUrl);
  if (!ALLOWED_PROTOCOLS.has(new URL(rawUrl).protocol)) {
    throw new Error("webhook URL scheme is not allowed");
  }
}

export async function dispatchWebhook(
  webhook: Webhook,
  payload: Record<string, unknown> = {},
): Promise<DispatchResult> {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", WEBHOOK_HMAC_KEY).update(body).digest("hex");
  let targetUrl = webhook.url;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    assertDispatchableUrl(targetUrl);
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Helios-Signature": signature,
      },
      body,
      redirect: "manual",
    });
    if (response.status < 300 || response.status >= 400) {
      return {
        finalUrl: targetUrl,
        status: response.status,
        bodySnippet: (await response.text()).slice(0, 512),
      };
    }
    const location = response.headers.get("location");
    if (!location) {
      return { finalUrl: targetUrl, status: response.status, bodySnippet: "" };
    }
    targetUrl = new URL(location, targetUrl).toString();
  }
  throw new Error("webhook redirect limit exceeded");
}
