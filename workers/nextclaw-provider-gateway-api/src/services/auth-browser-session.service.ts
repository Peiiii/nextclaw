import type { Context } from "hono";
import {
  renderBrowserAuthPage,
  type BrowserAuthLocale,
  type BrowserAuthMode,
} from "@/services/auth-browser-page-renderer.service.js";
import {
  createPlatformAuthSession,
  getPlatformAuthSessionById,
  updatePlatformAuthSessionStatus,
} from "@/repositories/platform-auth-session.repository";
import {
  DEFAULT_PLATFORM_AUTH_POLL_INTERVAL_MS,
  DEFAULT_PLATFORM_AUTH_SESSION_TTL_SECONDS,
  type Env,
} from "@/types/platform";
import { randomOpaqueToken } from "@/utils/platform.utils";

export async function createBrowserAuthSession(c: Context<{ Bindings: Env }>): Promise<{
  sessionId: string;
  expiresAt: string;
  verificationUri: string;
  intervalMs: number;
}> {
  const sessionId = randomOpaqueToken();
  const expiresAt = new Date(Date.now() + DEFAULT_PLATFORM_AUTH_SESSION_TTL_SECONDS * 1000).toISOString();
  await createPlatformAuthSession(c.env.NEXTCLAW_PLATFORM_DB, {
    id: sessionId,
    expiresAt,
  });
  return {
    sessionId,
    expiresAt,
    verificationUri: buildBrowserAuthUrl(c, sessionId),
    intervalMs: DEFAULT_PLATFORM_AUTH_POLL_INTERVAL_MS,
  };
}

function buildBrowserAuthUrl(c: Context<{ Bindings: Env }>, sessionId: string, mode?: BrowserAuthMode): string {
  const url = new URL(c.req.url);
  const forwardedProto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = c.req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || c.req.header("host")?.trim() || url.host;
  const protocol = forwardedProto || url.protocol.replace(/:$/, "");
  const query = new URLSearchParams({ sessionId });
  if (mode && mode !== "login") {
    query.set("mode", mode);
  }
  return `${protocol}://${host}/platform/auth/browser?${query.toString()}`;
}

export async function loadPlatformAuthSession(c: Context<{ Bindings: Env }>, sessionId: string) {
  const session = await getPlatformAuthSessionById(c.env.NEXTCLAW_PLATFORM_DB, sessionId);
  if (!session) {
    return null;
  }
  if (Date.parse(session.expires_at) > Date.now()) {
    return session;
  }
  if (session.status !== "expired") {
    await updatePlatformAuthSessionStatus(c.env.NEXTCLAW_PLATFORM_DB, {
      id: session.id,
      status: "expired",
      userId: session.user_id,
      updatedAt: new Date().toISOString(),
    });
  }
  return {
    ...session,
    status: "expired" as const,
  };
}

export function renderMissingSessionPage(locale: BrowserAuthLocale): Response {
  return renderBrowserAuthPage({
    sessionId: "",
    pageState: "missing",
    expiresAt: null,
    mode: "login",
    locale,
    errorCode: "MISSING_SESSION",
  });
}

export async function loadPendingBrowserAuthSession(
  c: Context<{ Bindings: Env }>,
  sessionId: string,
  mode: BrowserAuthMode,
  locale: BrowserAuthLocale,
  email?: string,
): Promise<
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof loadPlatformAuthSession>>> }
  | { ok: false; response: Response }
> {
  if (!sessionId) {
    return {
      ok: false,
      response: renderMissingSessionPage(locale),
    };
  }

  const session = await loadPlatformAuthSession(c, sessionId);
  if (!session) {
    return {
      ok: false,
      response: renderBrowserAuthPage({
        sessionId,
        pageState: "missing",
        expiresAt: null,
        mode,
        locale,
        email,
        errorCode: "SESSION_NOT_FOUND",
      }),
    };
  }

  if (session.status === "authorized") {
    return {
      ok: false,
      response: renderBrowserAuthPage({
        sessionId,
        pageState: "authorized",
        expiresAt: session.expires_at,
        mode,
        locale,
        email,
        successCode: "ALREADY_AUTHORIZED",
      }),
    };
  }

  if (session.status === "expired") {
    return {
      ok: false,
      response: renderBrowserAuthPage({
        sessionId,
        pageState: "expired",
        expiresAt: session.expires_at,
        mode,
        locale,
        email,
        errorCode: "SESSION_EXPIRED",
      }),
    };
  }

  return {
    ok: true,
    session,
  };
}

export async function authorizeBrowserSessionForUser(params: {
  env: Env;
  sessionId: string;
  userId: string;
}): Promise<void> {
  await updatePlatformAuthSessionStatus(params.env.NEXTCLAW_PLATFORM_DB, {
    id: params.sessionId,
    status: "authorized",
    userId: params.userId,
    updatedAt: new Date().toISOString(),
  });
}
