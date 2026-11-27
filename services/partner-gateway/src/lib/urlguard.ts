import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface AllowedTarget {
  url: URL;
  addresses: ResolvedAddress[];
}

export class UrlNotAllowedError extends Error {}

const blockedIpv4Subnets: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

// Includes every range that embeds an IPv4 address (mapped, compatible, NAT64, 6to4, Teredo).
const blockedIpv6Subnets: Array<[string, number]> = [
  ["::", 96],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
];

// Kept apart: an IPv6 rule for ::ffff:0:0/96 in a shared list would match every IPv4 address.
const blockedIpv4 = new BlockList();
for (const [network, prefix] of blockedIpv4Subnets) {
  blockedIpv4.addSubnet(network, prefix, "ipv4");
}
const blockedIpv6 = new BlockList();
for (const [network, prefix] of blockedIpv6Subnets) {
  blockedIpv6.addSubnet(network, prefix, "ipv6");
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    return blockedIpv4.check(address, "ipv4");
  }
  if (family === 6) {
    return blockedIpv6.check(address, "ipv6");
  }
  return true;
}

/**
 * Resolves the webhook host and rejects the URL unless every address is public.
 * Callers must connect to the returned addresses, not resolve the host again.
 */
export async function resolveAllowedTarget(rawUrl: string): Promise<AllowedTarget> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UrlNotAllowedError("invalid webhook URL");
  }
  if (url.protocol !== "https:") {
    throw new UrlNotAllowedError("webhook URL must use https");
  }
  if (url.username || url.password) {
    throw new UrlNotAllowedError("webhook URL must not contain credentials");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: ResolvedAddress[];
  const literalFamily = isIP(hostname);
  if (literalFamily !== 0) {
    addresses = [{ address: hostname, family: literalFamily as 4 | 6 }];
  } else {
    try {
      const resolved = await lookup(hostname, { all: true, verbatim: true });
      addresses = resolved.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
    } catch {
      throw new UrlNotAllowedError("webhook host could not be resolved");
    }
  }
  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new UrlNotAllowedError("webhook URL is not allowed");
  }
  return { url, addresses };
}
