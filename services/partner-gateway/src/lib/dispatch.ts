import { createHmac } from "node:crypto";

import { WEBHOOK_HMAC_KEY } from "../config";
import { postJson } from "./transport";
import { assertAllowedUrl } from "./urlguard";

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

export async function dispatchWebhook(
  webhook: Webhook,
  payload: Record<string, unknown> = {},
): Promise<DispatchResult> {
  const body = JSON.stringify(payload);
  const signature = createHmac("sha256", WEBHOOK_HMAC_KEY).update(body).digest("hex");
  let targetUrl = webhook.url;

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    // Every hop is checked, not only the registered URL.
    assertAllowedUrl(targetUrl);
    const response = await postJson(
      targetUrl,
      { "content-type": "application/json", "X-Helios-Signature": signature },
      body,
    );
    if (response.status < 300 || response.status >= 400) {
      return { finalUrl: targetUrl, status: response.status, bodySnippet: response.bodySnippet };
    }
    if (!response.location) {
      return { finalUrl: targetUrl, status: response.status, bodySnippet: "" };
    }
    targetUrl = new URL(response.location, targetUrl).toString();
  }
  throw new Error("webhook redirect limit exceeded");
}
