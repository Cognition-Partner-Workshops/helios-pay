import express from "express";

import { webhooksRouter } from "./routes/webhooks";

export const app = express();
app.use(express.json());

app.get("/healthz", (_request, response) => {
  response.json({ status: "ok", service: "partner-gateway" });
});

app.get("/", (_request, response) => {
  response.json({ service: "partner-gateway", version: "0.1.0" });
});

app.use("/partners/webhooks", webhooksRouter);
