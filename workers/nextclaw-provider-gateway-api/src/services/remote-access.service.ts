import type { Context } from "hono";
import {
  createRemoteAccessSession,
  getRemoteAccessSessionByToken,
  getRemoteShareGrantById,
} from "../repositories/remote.repository";
import { requireAuthUser } from "./platform.service";
import type { Env, RemoteAccessSessionRow, RemoteShareGrantRow } from "../types/platform";
import { DEFAULT_REMOTE_SESSION_TTL_SECONDS } from "../types/platform";
import {
  apiError,
  optionalTrimmedString,
  parseBearerToken,
  parseCookieHeader,
  randomOpaqueToken,
  verifySessionToken,
} from "../utils/platform.utils";
import { resolveHostBoundRemoteAccessSession } from "./remote-access-session-binding.service";

export const REMOTE_SESSION_COOKIE = "nextclaw_remote_session";
export const REMOTE_SESSION_TOUCH_THROTTLE_MS = 60_000;
export const DEFAULT_REMOTE_SHARE_GRANT_TTL_SECONDS = 60 * 60 * 24 * 7;
const REMOTE_ACCESS_SUBDOMAIN_PREFIX = "r-";

export type RemoteAccessUrlSet = {
  openUrl: string;
  fixedDomainOpenUrl: string | null;
};

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "::1" || hostname.startsWith("127.");
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return btoa(binary);
}

export function readRequestOrigin(c: Context<{ Bindings: Env }>): { protocol: string; host: string; hostname: string } {
  const url = new URL(c.req.url);
  const requestHost = c.req.header("host")?.trim() || url.host;
  const requestHostname = requestHost.replace(/:\d+$/, "");
  const trustForwardedOrigin = !isLoopbackHost(url.hostname) && !isLoopbackHost(requestHostname);
  const forwardedProto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = c.req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const host = trustForwardedOrigin ? (forwardedHost || requestHost) : requestHost;
  const protocol = trustForwardedOrigin ? (forwardedProto || url.protocol.replace(/:$/, "")) : url.protocol.replace(/:$/, "");
  const hostname = host.replace(/:\d+$/, "");
  return { protocol, host, hostname };
}

function readRemoteAccessBaseDomain(c: Context<{ Bindings: Env }>): string | null {
  return optionalTrimmedString(c.env.REMOTE_ACCESS_BASE_DOMAIN ?? "");
}

function readRemoteAccessFixedDomain(c: Context<{ Bindings: Env }>): string | null {
  return optionalTrimmedString(c.env.REMOTE_ACCESS_FIXED_DOMAIN ?? "");
}

function readWebBaseUrl(c: Context<{ Bindings: Env }>): string | null {
  const configured = optionalTrimmedString(c.env.NEXTCLAW_WEB_BASE_URL ?? "");
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  const origin = readRequestOrigin(c);
  return isLoopbackHost(origin.hostname) ? `${origin.protocol}://${origin.host}` : null;
}

function buildRemoteOpenPath(token: string): string {
  return `/platform/remote/open?token=${encodeURIComponent(token)}`;
}

function buildLegacyRemoteOpenUrl(c: Context<{ Bindings: Env }>, token: string): string {
  const origin = readRequestOrigin(c);
  return `${origin.protocol}://${origin.host}${buildRemoteOpenPath(token)}`;
}

export function buildRemoteAccessUrlSet(
  c: Context<{ Bindings: Env }>,
  sessionId: string,
  token: string
): RemoteAccessUrlSet | null {
  const origin = readRequestOrigin(c);
  const baseDomain = readRemoteAccessBaseDomain(c);
  const fixedDomain = readRemoteAccessFixedDomain(c);
  const openPath = buildRemoteOpenPath(token);
  let openUrl: string | null = null;

  if (!baseDomain) {
    openUrl = isLoopbackHost(origin.hostname) ? buildLegacyRemoteOpenUrl(c, token) : null;
  } else {
    openUrl = `${origin.protocol}://${REMOTE_ACCESS_SUBDOMAIN_PREFIX}${sessionId}.${baseDomain}${openPath}`;
  }
  if (!openUrl) {
    return null;
  }

  return {
    openUrl,
    fixedDomainOpenUrl: fixedDomain ? `${origin.protocol}://${fixedDomain}${openPath}` : null
  };
}

export function buildRemoteShareUrl(c: Context<{ Bindings: Env }>, grantToken: string): string | null {
  const webBaseUrl = readWebBaseUrl(c);
  if (!webBaseUrl) {
    return null;
  }
  return `${webBaseUrl}/share/${encodeURIComponent(grantToken)}`;
}

function readAccessSessionIdFromHost(c: Context<{ Bindings: Env }>): string | null {
  const baseDomain = readRemoteAccessBaseDomain(c);
  if (!baseDomain) {
    return null;
  }
  const origin = readRequestOrigin(c);
  if (origin.hostname === baseDomain || !origin.hostname.endsWith(`.${baseDomain}`)) {
    return null;
  }
  const prefix = origin.hostname.slice(0, -(baseDomain.length + 1)).trim();
  if (!prefix || prefix.includes(".")) {
    return null;
  }
  if (!prefix.startsWith(REMOTE_ACCESS_SUBDOMAIN_PREFIX)) {
    return null;
  }
  const sessionId = prefix.slice(REMOTE_ACCESS_SUBDOMAIN_PREFIX.length).trim();
  return sessionId || null;
}

function readRemoteSessionCookieToken(c: Context<{ Bindings: Env }>): string | null {
  const cookies = parseCookieHeader(c.req.header("cookie"));
  const token = cookies[REMOTE_SESSION_COOKIE]?.trim();
  return token || null;
}

export function isUpgradeWebSocket(c: Context<{ Bindings: Env }>): boolean {
  return c.req.header("upgrade")?.toLowerCase() === "websocket";
}

export function isExpiredAt(iso: string): boolean {
  return Date.parse(iso) <= Date.now();
}

function readConnectToken(c: Context<{ Bindings: Env }>): string | null {
  const fromHeader = parseBearerToken(c.req.header("authorization"));
  if (fromHeader) {
    return fromHeader;
  }
  const raw = c.req.query("token");
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function requireAuthUserFromConnectToken(c: Context<{ Bindings: Env }>) {
  const token = readConnectToken(c);
  if (!token) {
    return {
      ok: false as const,
      response: apiError(c, 401, "UNAUTHORIZED", "Missing bearer token.")
    };
  }
  const secret = c.env.AUTH_TOKEN_SECRET?.trim();
  if (!secret) {
    return {
      ok: false as const,
      response: apiError(c, 503, "UNAVAILABLE", "Auth secret is not configured.")
    };
  }
  const payload = await verifySessionToken(token, secret);
  if (!payload) {
    return {
      ok: false as const,
      response: apiError(c, 401, "UNAUTHORIZED", "Invalid or expired token.")
    };
  }
  return requireAuthUser({
    env: c.env,
    req: {
      header: (name: string) => {
        if (name.toLowerCase() === "authorization") {
          return `Bearer ${token}`;
        }
        return c.req.header(name);
      }
    }
  });
}

export async function createOwnerOpenSession(params: {
  c: Context<{ Bindings: Env }>;
  ownerUserId: string;
  instanceId: string;
}): Promise<RemoteAccessSessionRow> {
  const { c, ownerUserId, instanceId } = params;
  const sessionId = crypto.randomUUID();
  const token = randomOpaqueToken();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + DEFAULT_REMOTE_SESSION_TTL_SECONDS * 1000).toISOString();

  await createRemoteAccessSession(c.env.NEXTCLAW_PLATFORM_DB, {
    id: sessionId,
    token,
    userId: ownerUserId,
    instanceId,
    sourceType: "owner_open",
    openedByUserId: ownerUserId,
    expiresAt
  });

  return {
    id: sessionId,
    token,
    user_id: ownerUserId,
    instance_id: instanceId,
    status: "active",
    source_type: "owner_open",
    source_grant_id: null,
    opened_by_user_id: ownerUserId,
    expires_at: expiresAt,
    last_used_at: nowIso,
    revoked_at: null,
    created_at: nowIso,
    updated_at: nowIso
  };
}

export async function createShareOpenSession(params: {
  c: Context<{ Bindings: Env }>;
  grant: RemoteShareGrantRow;
}): Promise<RemoteAccessSessionRow> {
  const { c, grant } = params;
  const sessionId = crypto.randomUUID();
  const token = randomOpaqueToken();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresAt = new Date(now + DEFAULT_REMOTE_SESSION_TTL_SECONDS * 1000).toISOString();

  await createRemoteAccessSession(c.env.NEXTCLAW_PLATFORM_DB, {
    id: sessionId,
    token,
    userId: grant.owner_user_id,
    instanceId: grant.instance_id,
    sourceType: "share_grant",
    sourceGrantId: grant.id,
    openedByUserId: null,
    expiresAt
  });

  return {
    id: sessionId,
    token,
    user_id: grant.owner_user_id,
    instance_id: grant.instance_id,
    status: "active",
    source_type: "share_grant",
    source_grant_id: grant.id,
    opened_by_user_id: null,
    expires_at: expiresAt,
    last_used_at: nowIso,
    revoked_at: null,
    created_at: nowIso,
    updated_at: nowIso
  };
}

export async function resolveRemoteAccessSession(c: Context<{ Bindings: Env }>): Promise<RemoteAccessSessionRow | null> {
  const sessionId = readAccessSessionIdFromHost(c);
  const token = readRemoteSessionCookieToken(c);
  const cookieSession = token
    ? await getRemoteAccessSessionByToken(c.env.NEXTCLAW_PLATFORM_DB, token)
    : null;
  return resolveHostBoundRemoteAccessSession({
    hostSessionId: sessionId,
    cookieSession
  });
}

export async function validateRemoteAccessSession(
  c: Context<{ Bindings: Env }>,
  session: RemoteAccessSessionRow | null
): Promise<
  | { ok: true; session: RemoteAccessSessionRow }
  | { ok: false; response: Response }
> {
  if (!session) {
    return {
      ok: false,
      response: new Response("Remote access session not found.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" }
      })
    };
  }
  if (session.revoked_at || session.status !== "active") {
    return {
      ok: false,
      response: new Response("Remote access session revoked.", {
        status: 410,
        headers: { "content-type": "text/plain; charset=utf-8" }
      })
    };
  }
  if (isExpiredAt(session.expires_at)) {
    return {
      ok: false,
      response: new Response("Remote access session expired.", {
        status: 410,
        headers: { "content-type": "text/plain; charset=utf-8" }
      })
    };
  }
  if (session.source_grant_id) {
    const grant = await getRemoteShareGrantById(c.env.NEXTCLAW_PLATFORM_DB, session.source_grant_id);
    if (!grant || grant.status !== "active" || grant.revoked_at || isExpiredAt(grant.expires_at)) {
      return {
        ok: false,
        response: new Response("Remote share grant revoked.", {
          status: 410,
          headers: { "content-type": "text/plain; charset=utf-8" }
        })
      };
    }
  }
  return { ok: true, session };
}
