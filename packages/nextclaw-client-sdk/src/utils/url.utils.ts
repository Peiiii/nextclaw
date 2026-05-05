export function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new Error("NextClaw client baseUrl is required.");
  }
  return normalized;
}

export function resolveApiUrl(baseUrl: string, path: string): string {
  return `${normalizeBaseUrl(baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

export function resolveWebSocketUrl(baseUrl: string, path: string): string {
  const url = new URL(resolveApiUrl(baseUrl, path));
  if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else if (url.protocol === "http:") {
    url.protocol = "ws:";
  }
  return url.toString();
}
