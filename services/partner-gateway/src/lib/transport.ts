import { request } from "node:https";
import type { LookupFunction } from "node:net";

import type { AllowedTarget, ResolvedAddress } from "./urlguard";

export interface TransportResponse {
  status: number;
  location: string | null;
  body: string;
}

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 4096;

/** DNS lookup replacement that only ever returns the addresses the URL guard checked. */
export function pinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, addresses);
      return;
    }
    callback(null, addresses[0].address, addresses[0].family);
  };
}

export function postJson(
  target: AllowedTarget,
  body: string,
  headers: Record<string, string>,
): Promise<TransportResponse> {
  return new Promise((resolve, reject) => {
    const outgoing = request(
      target.url,
      {
        method: "POST",
        headers: { ...headers, "content-length": Buffer.byteLength(body).toString() },
        agent: false,
        lookup: pinnedLookup(target.addresses),
        timeout: REQUEST_TIMEOUT_MS,
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        let received = 0;
        const finish = () => {
          const locationHeader = incoming.headers.location;
          resolve({
            status: incoming.statusCode ?? 0,
            location: locationHeader ?? null,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        };
        incoming.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          received += chunk.length;
          if (received >= MAX_BODY_BYTES) {
            finish();
            incoming.destroy();
          }
        });
        incoming.on("end", finish);
        incoming.on("error", reject);
      },
    );
    outgoing.on("timeout", () => outgoing.destroy(new Error("webhook request timed out")));
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}
