import { createHmac } from "node:crypto";

import { WEBHOOK_HMAC_KEY } from "../config";

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
