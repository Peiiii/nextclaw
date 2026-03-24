const REMOTE_STATIC_RESERVED_PREFIXES = ["/platform/", "/v1/", "/_remote/"] as const;
const REMOTE_STATIC_RESERVED_EXACT = new Set(["/health"]);

export function isRemoteStaticAssetRequest(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }
  if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
    return false;
  }
  const url = new URL(request.url);
  if (REMOTE_STATIC_RESERVED_EXACT.has(url.pathname)) {
    return false;
  }
  return !REMOTE_STATIC_RESERVED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

export async function fetchRemoteStaticAssetResponse(params: {
  assets: { fetch(input: Request | URL | string): Promise<Response> } | null | undefined;
  request: Request;
}): Promise<Response | null> {
  const assets = params.assets;
  if (!assets) {
    return null;
  }

  const assetResponse = await assets.fetch(params.request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  const url = new URL(params.request.url);
  if (looksLikeStaticFilePath(url.pathname)) {
    return null;
  }

  const indexUrl = new URL("/index.html", url);
  return await assets.fetch(new Request(indexUrl, params.request));
}

function looksLikeStaticFilePath(pathname: string): boolean {
  const segment = pathname.split("/").pop()?.trim() ?? "";
  return segment.length > 0 && segment.includes(".");
}
