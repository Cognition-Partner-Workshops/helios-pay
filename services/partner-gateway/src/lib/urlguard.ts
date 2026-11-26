import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { BlockList, isIP } from "node:net";

import { CORE_API_URL, GATEWAY_URL, LEDGER_URL } from "../config";

const NOT_ALLOWED = "webhook URL is not allowed";

const blockedAddresses = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 127],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, "ipv6");
}

const blockedHostNames = new Set(["localhost", "metadata", "metadata.google.internal"]);
const blockedHostSuffixes = [".localhost", ".local", ".internal", ".lan", ".home.arpa"];

for (const serviceUrl of [CORE_API_URL, LEDGER_URL, GATEWAY_URL]) {
  try {
    blockedHostNames.add(normalizeHost(new URL(serviceUrl).hostname));
  } catch {
    // not a URL, nothing to block
  }
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

function mappedIpv4(address: string): string | null {
  const match = /^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/i.exec(address);
  if (!match) {
    return null;
  }
  if (match[1]) {
    return match[1];
  }
  const high = parseInt(match[2], 16);
  const low = parseInt(match[3], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return blockedAddresses.check(address, "ipv4");
  }
  if (family === 6) {
    const ipv4 = mappedIpv4(address);
    return ipv4 ? blockedAddresses.check(ipv4, "ipv4") : blockedAddresses.check(address, "ipv6");
  }
  return true;
}

export function assertAllowedUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("invalid webhook URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(NOT_ALLOWED);
  }
  const host = normalizeHost(parsed.hostname);
  if (isIP(host)) {
    if (isBlockedAddress(host)) {
      throw new Error(NOT_ALLOWED);
    }
    return;
  }
  // Single-label names only resolve inside the deployment network (compose/Kubernetes service names).
  if (
    !host.includes(".") ||
    blockedHostNames.has(host) ||
    blockedHostSuffixes.some((suffix) => host.endsWith(suffix))
  ) {
    throw new Error(NOT_ALLOWED);
  }
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

// DNS lookup for the outbound socket: the connection is made to the addresses checked here,
// so a name that resolves (or re-resolves) to an internal address cannot be reached.
export function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number | string; hints?: number },
  callback: LookupCallback,
): void {
  const family = options.family === "IPv4" ? 4 : options.family === "IPv6" ? 6 : options.family;
  dnsLookup(hostname, { family: family as number | undefined, hints: options.hints, all: true }, (error, addresses) => {
    if (error) {
      callback(error, []);
      return;
    }
    if (addresses.length === 0 || addresses.some((entry) => isBlockedAddress(entry.address))) {
      callback(new Error(NOT_ALLOWED), []);
      return;
    }
    if (options.all) {
      callback(null, addresses);
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  });
}
