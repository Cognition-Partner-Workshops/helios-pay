import { createHmac } from "node:crypto";

import { WEBHOOK_HMAC_KEY } from "../config";
import { postJson } from "./transport";
import { resolveAllowedTarget } from "./urlguard";

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
    // Checked on every hop; the request connects only to the addresses checked here.
    const target = await resolveAllowedTarget(targetUrl);
    const response = await postJson(target, body, {
      "content-type": "application/json",
      "X-Helios-Signature": signature,
    });
    if (response.status < 300 || response.status >= 400) {
      return {
        finalUrl: targetUrl,
        status: response.status,
        bodySnippet: response.body.slice(0, 512),
      };
    }
    if (!response.location) {
      return { finalUrl: targetUrl, status: response.status, bodySnippet: "" };
    }
    targetUrl = new URL(response.location, targetUrl).toString();
  }
  throw new Error("webhook redirect limit exceeded");
}
