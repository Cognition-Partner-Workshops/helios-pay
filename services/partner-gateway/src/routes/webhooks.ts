import { randomUUID } from "node:crypto";

import { Router } from "express";

import { requireAuth } from "../middleware/auth";
import { dispatchWebhook, type Webhook } from "../lib/dispatch";
import { assertAllowedUrl } from "../lib/urlguard";

interface WebhookRequest {
  url: string;
  events: string[];
}

const webhooks = new Map<string, Webhook>();
export const webhooksRouter = Router();
webhooksRouter.use(requireAuth);

webhooksRouter.post("/", (request, response) => {
  const { url, events } = request.body as Partial<WebhookRequest>;
  if (!url || !Array.isArray(events)) {
    response.status(400).json({ error: "url and events are required" });
    return;
  }
  try {
    assertAllowedUrl(url);
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "invalid URL" });
    return;
  }
  const webhook: Webhook = { id: randomUUID(), url, events };
  webhooks.set(webhook.id, webhook);
  response.status(201).json(webhook);
});

webhooksRouter.post("/:id/send", async (request, response) => {
  const webhook = webhooks.get(request.params.id);
  if (!webhook) {
    response.status(404).json({ error: "webhook not found" });
    return;
  }
  try {
    const result = await dispatchWebhook(webhook, request.body?.payload);
    response.json(result);
  } catch (error) {
    response.status(502).json({ error: error instanceof Error ? error.message : "dispatch failed" });
  }
});
