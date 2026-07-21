import type { Context } from "hono";
import { RemoteControllerQuotaSupportService } from "@/services/remote-controller-quota-support.service";
import { RemoteProxyAccessService } from "@/services/remote-proxy-access.service";
import { appendAuditLog } from "@/repositories/platform.repository";
import { renderRemoteAccessErrorPage } from "@/services/remote-access-error-page-renderer.service";
import {
  closeRemoteAccessSessionsByGrantId,
  createRemoteShareGrant,
  getRemoteAccessSessionByToken,
  getRemoteShareGrantById,
  getRemoteShareGrantByToken,
  listRemoteShareGrantsByInstanceId,
  revokeRemoteShareGrant,
  toRemoteShareGrantView,
  toRemoteAccessSessionView,
} from "@/repositories/remote.repository";
import { getRemoteInstanceById } from "@/repositories/remote-instance.repository";
import {
  ensurePlatformBootstrap,
  requireAuthUser,
} from "@/services/platform.service";
import {
  DEFAULT_REMOTE_SHARE_GRANT_TTL_SECONDS,
  encodeBase64,
  isExpiredAt,
  isUpgradeWebSocket,
  readRequestOrigin,
  RemoteAccessService,
  REMOTE_SESSION_COOKIE,
} from "@/services/remote-access.service";
import type { Env } from "@/types/platform";
import { DEFAULT_REMOTE_SESSION_TTL_SECONDS } from "@/types/platform";
import {
  apiError,
  buildCookie,
  optionalTrimmedString,
  randomOpaqueToken,
  readJson,
  readNumber,
  sanitizeResponseHeaders,
} from "@/utils/platform.utils";

const REMOTE_DOCUMENT_CACHE_CONTROL =
  "private, no-store, max-age=0, must-revalidate";
const REMOTE_PROXY_BLOCKED_HEADERS = new Set([
  "cookie",
  "host",
  "connection",
  "content-length",
  "cf-connecting-ip",
  "x-forwarded-for",
  "x-forwarded-proto",
]);

function requireRemoteShareUrl(
  c: Context<{ Bindings: Env }>,
  grantToken: string,
): string | Response {
  return (
    new RemoteAccessService(c).buildShareUrl(grantToken) ??
    apiError(
      c,
      503,
      "REMOTE_SHARE_URL_UNAVAILABLE",
      "NextClaw Web base URL is not configured.",
    )
  );
}

function isHtmlNavigationRequest(c: Context<{ Bindings: Env }>): boolean {
  const dest = c.req.header("sec-fetch-dest")?.trim().toLowerCase();
  const mode = c.req.header("sec-fetch-mode")?.trim().toLowerCase();
  return c.req.method === "GET" && (dest === "document" || mode === "navigate");
}

function withVaryCookie(source: Headers): Headers {
  const headers = new Headers(source);
  if (
    !(headers.get("vary") ?? "")
      .split(",")
      .some((value) => value.trim().toLowerCase() === "cookie")
  ) {
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
    headers: withVaryCookie(headers),
  });
}

async function maybeRenderRemoteAccessErrorPage(
  c: Context<{ Bindings: Env }>,
  response: Response,
): Promise<Response> {
  if (!isHtmlNavigationRequest(c)) {
    return response;
  }
  const message =
    (await response.text()).trim() || "Remote access unavailable.";
  const webBaseUrl = optionalTrimmedString(c.env.NEXTCLAW_WEB_BASE_URL ?? "");
  return renderRemoteAccessErrorPage({
    status: response.status,
    message,
    webBaseUrl,
  });
}

async function requireOwnedRemoteInstance(c: Context<{ Bindings: Env }>) {
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }
  const instanceId = c.req.param("instanceId")?.trim() ?? "";
  if (!instanceId) {
    return apiError(c, 400, "INVALID_INSTANCE", "instanceId is required.");
  }
  const instance = await getRemoteInstanceById(
    c.env.NEXTCLAW_PLATFORM_DB,
    instanceId,
  );
  return !instance || instance.user_id !== auth.user.id
    ? apiError(c, 404, "INSTANCE_NOT_FOUND", "Remote instance not found.")
    : { auth, instance };
}

export async function listRemoteShareGrantsHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const owned = await requireOwnedRemoteInstance(c);
  if (owned instanceof Response) {
    return owned;
  }

  const rows = await listRemoteShareGrantsByInstanceId(
    c.env.NEXTCLAW_PLATFORM_DB,
    owned.instance.id,
  );
  const items = rows.map((row) => {
    const shareUrl = requireRemoteShareUrl(c, row.token);
    return shareUrl instanceof Response
      ? shareUrl
      : toRemoteShareGrantView(row, shareUrl);
  });
  const failure = items.find((item) => item instanceof Response);
  if (failure instanceof Response) {
    return failure;
  }
  return c.json({
    ok: true,
    data: {
      items,
    },
  });
}

export async function createRemoteShareGrantHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const owned = await requireOwnedRemoteInstance(c);
  if (owned instanceof Response) {
    return owned;
  }
  const { auth, instance } = owned;

  const body = await readJson(c);
  const requestedTtlSeconds = readNumber(body, "ttlSeconds");
  const ttlSeconds =
    Number.isFinite(requestedTtlSeconds) && requestedTtlSeconds > 0
      ? Math.min(
          Math.trunc(requestedTtlSeconds),
          DEFAULT_REMOTE_SHARE_GRANT_TTL_SECONDS,
        )
      : DEFAULT_REMOTE_SHARE_GRANT_TTL_SECONDS;
  const grantId = crypto.randomUUID();
  const token = randomOpaqueToken();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();

  await createRemoteShareGrant(c.env.NEXTCLAW_PLATFORM_DB, {
    id: grantId,
    token,
    ownerUserId: auth.user.id,
    instanceId: instance.id,
    expiresAt,
  });

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.share_grant.created",
    targetType: "remote_share_grant",
    targetId: grantId,
    beforeJson: null,
    afterJson: JSON.stringify({
      id: grantId,
      instanceId: instance.id,
      expiresAt,
    }),
    metadataJson: null,
  });

  const shareUrl = requireRemoteShareUrl(c, token);
  if (shareUrl instanceof Response) {
    return shareUrl;
  }

  return c.json({
    ok: true,
    data: toRemoteShareGrantView(
      {
        id: grantId,
        token,
        owner_user_id: auth.user.id,
        instance_id: instance.id,
        status: "active",
        expires_at: expiresAt,
        revoked_at: null,
        created_at: nowIso,
        updated_at: nowIso,
        active_session_count: 0,
      },
      shareUrl,
    ),
  });
}

export async function revokeRemoteShareGrantHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const auth = await requireAuthUser(c);
  if (!auth.ok) {
    return auth.response;
  }

  const grantId = c.req.param("grantId")?.trim() ?? "";
  if (!grantId) {
    return apiError(c, 400, "INVALID_GRANT", "grantId is required.");
  }
  const grant = await getRemoteShareGrantById(
    c.env.NEXTCLAW_PLATFORM_DB,
    grantId,
  );
  if (!grant) {
    return apiError(c, 404, "GRANT_NOT_FOUND", "Remote share grant not found.");
  }
  if (grant.owner_user_id !== auth.user.id) {
    return apiError(c, 404, "GRANT_NOT_FOUND", "Remote share grant not found.");
  }

  const revokedAt = new Date().toISOString();
  await revokeRemoteShareGrant(c.env.NEXTCLAW_PLATFORM_DB, grant.id, revokedAt);
  await closeRemoteAccessSessionsByGrantId(
    c.env.NEXTCLAW_PLATFORM_DB,
    grant.id,
    revokedAt,
  );
  const shareUrl = requireRemoteShareUrl(c, grant.token);
  if (shareUrl instanceof Response) {
    return shareUrl;
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: auth.user.id,
    action: "remote.share_grant.revoked",
    targetType: "remote_share_grant",
    targetId: grant.id,
    beforeJson: JSON.stringify(toRemoteShareGrantView(grant, shareUrl)),
    afterJson: JSON.stringify({
      ...toRemoteShareGrantView(grant, shareUrl),
      status: "revoked",
      revokedAt,
      activeSessionCount: 0,
    }),
    metadataJson: null,
  });

  return c.json({
    ok: true,
    data: {
      revoked: true,
      grantId: grant.id,
      revokedAt,
    },
  });
}

export async function openRemoteShareSessionHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const grantToken = optionalTrimmedString(c.req.param("grantToken") ?? "");
  if (!grantToken) {
    return apiError(c, 400, "INVALID_GRANT_TOKEN", "Missing share token.");
  }

  const grant = await getRemoteShareGrantByToken(
    c.env.NEXTCLAW_PLATFORM_DB,
    grantToken,
  );
  if (
    !grant ||
    grant.status !== "active" ||
    grant.revoked_at ||
    isExpiredAt(grant.expires_at)
  ) {
    return apiError(
      c,
      410,
      "GRANT_NOT_AVAILABLE",
      "Remote share link is no longer available.",
    );
  }

  const instance = await getRemoteInstanceById(
    c.env.NEXTCLAW_PLATFORM_DB,
    grant.instance_id,
  );
  if (!instance || instance.status !== "online") {
    return apiError(c, 409, "INSTANCE_OFFLINE", "Remote instance is offline.");
  }

  const remoteAccess = new RemoteAccessService(c);
  const session = await remoteAccess.createShareOpenSession(grant);
  const urls = remoteAccess.buildAccessUrlSet(session.id, session.token);
  if (!urls) {
    return apiError(
      c,
      503,
      "REMOTE_ACCESS_DOMAIN_UNAVAILABLE",
      "Remote access public domain is not configured.",
    );
  }

  await appendAuditLog(c.env.NEXTCLAW_PLATFORM_DB, {
    actorUserId: grant.owner_user_id,
    action: "remote.access_session.created_from_share",
    targetType: "remote_access_session",
    targetId: session.id,
    beforeJson: null,
    afterJson: JSON.stringify({
      id: session.id,
      instanceId: session.instance_id,
      sourceType: session.source_type,
      sourceGrantId: session.source_grant_id,
      expiresAt: session.expires_at,
    }),
    metadataJson: JSON.stringify({ shareGrantId: grant.id }),
  });

  return c.json({
    ok: true,
    data: toRemoteAccessSessionView(session, urls),
  });
}

export async function openRemoteSessionRedirectHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const token = optionalTrimmedString(c.req.query("token") ?? "");
  if (!token) {
    return apiError(c, 400, "INVALID_TOKEN", "Missing remote session token.");
  }
  const session = await getRemoteAccessSessionByToken(
    c.env.NEXTCLAW_PLATFORM_DB,
    token,
  );
  const remoteAccess = new RemoteAccessService(c);
  const validated = await remoteAccess.validateAccessSession(session);
  if (!validated.ok) {
    return validated.response;
  }
  const domainBinding = await remoteAccess.resolveInstanceDomainBinding();
  if (
    domainBinding.isInstanceDomain &&
    (!domainBinding.instance ||
      domainBinding.instance.id !== validated.session.instance_id)
  ) {
    return new Response(
      "Remote instance domain does not match this access session.",
      {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      },
    );
  }

  const headers = withVaryCookie(
    new Headers({
      "Set-Cookie": buildCookie({
        name: REMOTE_SESSION_COOKIE,
        value: token,
        path: "/",
        secure: readRequestOrigin(c).protocol === "https",
        httpOnly: true,
        sameSite: "Lax",
        maxAgeSeconds: DEFAULT_REMOTE_SESSION_TTL_SECONDS,
      }),
      Location: "/",
      "Cache-Control": REMOTE_DOCUMENT_CACHE_CONTROL,
    }),
  );
  return new Response(null, { status: 302, headers });
}

export async function remoteConnectorWebSocketHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  if (!isUpgradeWebSocket(c)) {
    return apiError(c, 426, "UPGRADE_REQUIRED", "Expected websocket upgrade.");
  }
  const auth = await new RemoteAccessService(
    c,
  ).requireAuthUserFromConnectToken();
  if (!auth.ok) {
    return auth.response;
  }
  const instanceId =
    c.req.query("instanceId")?.trim() || c.req.query("deviceId")?.trim() || "";
  if (!instanceId) {
    return apiError(c, 400, "INVALID_INSTANCE", "instanceId is required.");
  }
  const instance = await getRemoteInstanceById(
    c.env.NEXTCLAW_PLATFORM_DB,
    instanceId,
  );
  if (!instance || instance.user_id !== auth.user.id) {
    return apiError(c, 404, "INSTANCE_NOT_FOUND", "Remote instance not found.");
  }

  const quotaResponse = await new RemoteControllerQuotaSupportService(
    c.env,
  ).enforceDailyQuota(auth.user.id, "connector_connect");
  if (quotaResponse) {
    return quotaResponse;
  }

  const stub = c.env.NEXTCLAW_REMOTE_RELAY.get(
    c.env.NEXTCLAW_REMOTE_RELAY.idFromName(instance.id),
  );
  const headers = new Headers(c.req.raw.headers);
  headers.set("x-nextclaw-remote-role", "connector");
  headers.set("x-nextclaw-remote-device-id", instance.id);
  headers.set("x-nextclaw-remote-user-id", auth.user.id);
  return stub.fetch(new Request(c.req.raw, { headers }));
}

export async function remoteBrowserRuntimeHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const resolved = await new RemoteProxyAccessService(c).resolve();
  if (resolved instanceof Response) {
    return resolved;
  }
  const quotaResponse = await new RemoteControllerQuotaSupportService(
    c.env,
  ).enforceDailyQuota(resolved.session.user_id, "runtime_http");
  if (quotaResponse) {
    return quotaResponse;
  }

  return c.json({
    ok: true,
    data: {
      mode: "remote",
      protocolVersion: 1,
      wsPath: "/_remote/ws",
    },
  });
}

export async function remoteBrowserWebSocketHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  if (!isUpgradeWebSocket(c)) {
    return apiError(c, 426, "UPGRADE_REQUIRED", "Expected websocket upgrade.");
  }

  const resolved = await new RemoteProxyAccessService(c).resolve();
  if (resolved instanceof Response) {
    return resolved;
  }
  return await new RemoteControllerQuotaSupportService(
    c.env,
  ).openBrowserRelaySocket({
    rawRequest: c.req.raw,
    session: resolved.session,
    instanceId: resolved.instance.id,
  });
}

export async function remoteProxyHandler(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const url = new URL(c.req.url);
  const isReservedPath = ["/platform/", "/v1/", "/_remote/"].some((prefix) =>
    url.pathname.startsWith(prefix),
  );
  if (isReservedPath || url.pathname === "/health") {
    return apiError(c, 404, "NOT_FOUND", "endpoint not found");
  }
  if (isUpgradeWebSocket(c)) {
    return apiError(
      c,
      501,
      "REMOTE_WS_UNAVAILABLE",
      "Remote WebSocket proxy is not enabled in this MVP.",
    );
  }

  const resolved = await new RemoteProxyAccessService(c).resolve();
  if (resolved instanceof Response) {
    return applyRemoteDocumentCachePolicy(
      c,
      await maybeRenderRemoteAccessErrorPage(c, resolved),
    );
  }
  const quotaResponse = await new RemoteControllerQuotaSupportService(
    c.env,
  ).enforceDailyQuota(resolved.session.user_id, "proxy_http");
  if (quotaResponse) {
    return quotaResponse;
  }
  const { instance } = resolved;

  const stub = c.env.NEXTCLAW_REMOTE_RELAY.get(
    c.env.NEXTCLAW_REMOTE_RELAY.idFromName(instance.id),
  );
  const path = `${url.pathname}${url.search}`;
  const rawBody = ["GET", "HEAD"].includes(c.req.method)
    ? null
    : new Uint8Array(await c.req.raw.arrayBuffer());
  const response = await stub.fetch("https://remote-relay.internal/proxy", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nextclaw-remote-device-id": instance.id,
    },
    body: JSON.stringify({
      method: c.req.method,
      path,
      headers: Array.from(c.req.raw.headers.entries()).filter(
        ([key]) => !REMOTE_PROXY_BLOCKED_HEADERS.has(key.toLowerCase()),
      ),
      bodyBase64: rawBody ? encodeBase64(rawBody) : "",
    }),
  });
  return applyRemoteDocumentCachePolicy(
    c,
    new Response(response.body, {
      status: response.status,
      headers: sanitizeResponseHeaders(response.headers),
    }),
  );
}
