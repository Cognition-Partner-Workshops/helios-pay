import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

import { guardedLookup } from "./urlguard";

export interface TransportResponse {
  status: number;
  location: string | null;
  bodySnippet: string;
}

const SNIPPET_LENGTH = 512;
const TIMEOUT_MS = 10_000;

// Sends one POST without following redirects; name resolution goes through guardedLookup.
export function postJson(
  url: string,
  headers: Record<string, string>,
  body: string,
): Promise<TransportResponse> {
  return new Promise((resolve, reject) => {
    const send = new URL(url).protocol === "https:" ? httpsRequest : httpRequest;
    const outgoing = send(
      url,
      {
        method: "POST",
        headers: { ...headers, "content-length": Buffer.byteLength(body).toString() },
        lookup: guardedLookup as never,
        timeout: TIMEOUT_MS,
      },
      (incoming) => {
        const location = incoming.headers.location ?? null;
        const status = incoming.statusCode ?? 0;
        let text = "";
        incoming.setEncoding("utf8");
        incoming.on("data", (chunk: string) => {
          text += chunk;
          if (text.length >= SNIPPET_LENGTH) {
            incoming.destroy();
          }
        });
        incoming.on("close", () => {
          resolve({ status, location, bodySnippet: text.slice(0, SNIPPET_LENGTH) });
        });
      },
    );
    outgoing.on("timeout", () => outgoing.destroy(new Error("webhook request timed out")));
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}
