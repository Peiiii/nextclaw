const PANEL_APP_RUNTIME_TOKEN_HEADER = "x-nextclaw-panel-bridge-session";

export function isPanelAppSandboxProxyRequest(request: Request): boolean {
  const method = request.method.toUpperCase();
  const path = new URL(request.url).pathname;
  const isPanelResource = path === "/api/panel-app-client-sdk.js" || path.startsWith("/api/panel-app-assets/");
  if ((method === "GET" || method === "HEAD") && isPanelResource) {
    return true;
  }
  if (request.headers.get("origin")?.trim() !== "null" || !path.startsWith("/api/")) {
    return false;
  }
  const requestedHeaders = request.headers.get("access-control-request-headers")?.toLowerCase().split(",");
  return method === "OPTIONS"
    ? Boolean(requestedHeaders?.some((header) => header.trim() === PANEL_APP_RUNTIME_TOKEN_HEADER))
    : Boolean(request.headers.get(PANEL_APP_RUNTIME_TOKEN_HEADER)?.trim());
}

export function readRemoteSessionIdFromHost(hostname: string, baseDomain: string | null): string | null {
  const suffix = baseDomain ? `.${baseDomain}` : "";
  if (!suffix || !hostname.endsWith(suffix)) {
    return null;
  }
  const prefix = hostname.slice(0, -suffix.length);
  return prefix.startsWith("r-") && !prefix.includes(".") ? prefix.slice(2).trim() || null : null;
}
