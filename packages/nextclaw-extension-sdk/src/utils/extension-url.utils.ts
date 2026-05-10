export function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    throw new Error("NextClaw extension endpoint is required.");
  }
  return trimmed.replace(/\/+$/, "");
}

export function resolveWebSocketUrl(endpoint: string, path: string): string {
  const url = new URL(path, `${normalizeEndpoint(endpoint)}/`);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}
