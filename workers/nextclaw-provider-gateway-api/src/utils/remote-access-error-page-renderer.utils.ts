import type { Context } from "hono";
import type { Env } from "@/types/platform";
import { optionalTrimmedString } from "@/utils/platform.utils";

export const REMOTE_DOCUMENT_CACHE_CONTROL =
  "private, no-store, max-age=0, must-revalidate";

function isHtmlNavigationRequest(c: Context<{ Bindings: Env }>): boolean {
  const dest = c.req.header("sec-fetch-dest")?.trim().toLowerCase();
  const mode = c.req.header("sec-fetch-mode")?.trim().toLowerCase();
  return c.req.method === "GET" && (dest === "document" || mode === "navigate");
}

export function withRemoteVaryCookie(source: Headers): Headers {
  const headers = new Headers(source);
  const variesByCookie = (headers.get("vary") ?? "")
    .split(",")
    .some((value) => value.trim().toLowerCase() === "cookie");
  if (!variesByCookie) {
    headers.append("Vary", "Cookie");
  }
  return headers;
}

function applyRemoteDocumentCachePolicy(
  c: Context<{ Bindings: Env }>,
  response: Response,
): Response {
  const headers = new Headers(response.headers);
  const contentType = headers.get("content-type")?.toLowerCase() ?? "";
  if (!isHtmlNavigationRequest(c) && !contentType.includes("text/html")) {
    return response;
  }
  headers.set("Cache-Control", REMOTE_DOCUMENT_CACHE_CONTROL);
  return new Response(response.body, {
    status: response.status,
    headers: withRemoteVaryCookie(headers),
  });
}

export async function presentRemoteAccessResponse(
  c: Context<{ Bindings: Env }>,
  response: Response,
): Promise<Response> {
  if (response.ok || !isHtmlNavigationRequest(c)) {
    return applyRemoteDocumentCachePolicy(c, response);
  }
  const message =
    (await response.text()).trim() || "Remote access unavailable.";
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterValue = retryAfterHeader
    ? Number(retryAfterHeader)
    : Number.NaN;
  const rendered = renderRemoteAccessErrorPage({
    status: response.status,
    message,
    webBaseUrl: optionalTrimmedString(c.env.NEXTCLAW_WEB_BASE_URL ?? ""),
    incidentId: optionalTrimmedString(
      response.headers.get("x-nextclaw-incident-id") ?? "",
    ),
    retryAfterSeconds: Number.isFinite(retryAfterValue)
      ? retryAfterValue
      : null,
  });
  return applyRemoteDocumentCachePolicy(c, rendered);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveTitle(message: string, status: number): string {
  if (message === "Remote device connector is offline.") {
    return "Remote connector is reconnecting";
  }
  if (status === 404) {
    return "Remote session not found";
  }
  if (status === 410) {
    return "Remote session no longer available";
  }
  return "Remote access unavailable";
}

function resolveDescription(message: string, status: number): string {
  if (message === "Remote device connector is offline.") {
    return "The device connection was interrupted. This page will retry automatically while NextClaw reconnects.";
  }
  if (message === "Remote access session expired.") {
    return "This remote access session has expired. Open the device again from NextClaw to create a fresh browser session.";
  }
  if (message === "Remote access session revoked.") {
    return "This remote access session was revoked. Reopen the device from NextClaw if you still need access.";
  }
  if (message === "Remote share grant revoked.") {
    return "This shared remote link is no longer valid. Ask the owner to generate a new share link.";
  }
  if (status === 404) {
    return "This remote access session no longer exists. Open the device again from NextClaw to create a fresh browser session.";
  }
  return "Remote access is temporarily unavailable. Return to NextClaw and start a new remote session.";
}

function createErrorPageHeaders(params: {
  reconnecting: boolean;
  retryAfterSeconds: number;
  incidentId?: string | null;
}): Headers {
  const { incidentId, reconnecting, retryAfterSeconds } = params;
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  if (reconnecting) {
    headers.set("retry-after", String(retryAfterSeconds));
  }
  if (incidentId) {
    headers.set("x-nextclaw-incident-id", incidentId);
  }
  return headers;
}

const REMOTE_ACCESS_ERROR_PAGE_STYLE = `
  :root {
    color-scheme: light;
    --bg: #f5f7fb;
    --card: rgba(255, 255, 255, 0.92);
    --border: rgba(15, 23, 42, 0.08);
    --text: #0f172a;
    --muted: #475569;
    --accent: #0f766e;
    --accent-hover: #115e59;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(circle at top left, rgba(15, 118, 110, 0.10), transparent 32%),
      linear-gradient(180deg, #fbfcfe 0%, var(--bg) 100%);
    color: var(--text);
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .card {
    width: min(560px, 100%);
    padding: 32px;
    border-radius: 24px;
    background: var(--card);
    border: 1px solid var(--border);
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
  }
  .eyebrow {
    display: inline-flex;
    margin-bottom: 12px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(15, 118, 110, 0.10);
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0 0 12px;
    font-size: clamp(28px, 4vw, 38px);
    line-height: 1.12;
  }
  p { margin: 0; color: var(--muted); }
  .detail {
    margin-top: 16px;
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(148, 163, 184, 0.10);
    color: var(--text);
    font-size: 14px;
    word-break: break-word;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 24px;
  }
  .primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 12px;
    background: var(--accent);
    color: white;
    text-decoration: none;
    font-weight: 600;
  }
  .primary:hover { background: var(--accent-hover); }
  .secondary {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 16px;
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
  }
  .secondary:hover { text-decoration: underline; }
  .incident {
    margin-top: 12px;
    color: var(--muted);
    font-size: 13px;
  }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
`;

export function renderRemoteAccessErrorPage(params: {
  status: number;
  message: string;
  webBaseUrl?: string | null;
  incidentId?: string | null;
  retryAfterSeconds?: number | null;
}): Response {
  const {
    incidentId,
    message,
    retryAfterSeconds: requestedRetryAfterSeconds,
    status,
    webBaseUrl,
  } = params;
  const reconnecting = message === "Remote device connector is offline.";
  const retryAfterSeconds =
    reconnecting && Number.isFinite(requestedRetryAfterSeconds)
      ? Math.max(1, Math.trunc(requestedRetryAfterSeconds ?? 5))
      : 5;
  const title = resolveTitle(message, status);
  const description = resolveDescription(message, status);
  const homeLink = webBaseUrl?.trim() ? webBaseUrl.trim().replace(/\/+$/, "") : null;
  const actions = [
    reconnecting ? `<a class="primary" href="">Retry now</a>` : "",
    homeLink
      ? `<a class="${reconnecting ? "secondary" : "primary"}" href="${escapeHtml(homeLink)}">Open NextClaw Web</a>`
      : "",
  ].join("");
  const incidentDetail = incidentId
    ? `<div class="incident">Incident ID: <code>${escapeHtml(incidentId)}</code></div>`
    : "";
  const refreshMeta = reconnecting
    ? `<meta http-equiv="refresh" content="${retryAfterSeconds}" />`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${refreshMeta}
    <title>${escapeHtml(title)}</title>
    <style>${REMOTE_ACCESS_ERROR_PAGE_STYLE}</style>
  </head>
  <body>
    <main class="card">
      <div class="eyebrow">NextClaw Remote Access</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(description)}</p>
      <div class="detail">${escapeHtml(message)}</div>
      ${incidentDetail}
      <div class="actions">${actions}</div>
    </main>
  </body>
</html>`;

  const headers = createErrorPageHeaders({
    reconnecting,
    retryAfterSeconds,
    incidentId,
  });
  return new Response(html, { status, headers });
}
