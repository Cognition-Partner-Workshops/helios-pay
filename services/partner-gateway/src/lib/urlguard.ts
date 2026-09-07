const blockedPrefixes = [
  "169.254.169.254",
  "metadata",
  "localhost",
  "127.",
  "0.0.0.0",
  "10.",
  "192.168.",
  "172.16.",
  "172.17.",
  "172.18.",
  "172.19.",
  "172.20.",
  "172.21.",
  "172.22.",
  "172.23.",
  "172.24.",
  "172.25.",
  "172.26.",
  "172.27.",
  "172.28.",
  "172.29.",
  "172.30.",
  "172.31.",
  "::1",
  "[::]",
];

export function assertAllowedUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("invalid webhook URL");
  }
  const candidate = `${rawUrl.toLowerCase()} ${parsed.hostname.toLowerCase()}`;
  if (blockedPrefixes.some((prefix) => candidate.includes(prefix))) {
    throw new Error("webhook URL is not allowed");
  }
}
