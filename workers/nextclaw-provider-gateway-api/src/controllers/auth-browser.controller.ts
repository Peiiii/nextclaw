import type { Context } from "hono";
import { getUserById } from "@/repositories/platform.repository";
import {
  createPlatformAuthSession,
  getPlatformAuthSessionById,
  updatePlatformAuthSessionStatus
} from "@/repositories/platform-auth-session.repository";
import {
  authenticatePlatformUser,
  isPlatformAuthServiceError,
  issuePlatformTokenResult,
  registerPlatformUser
} from "@/services/platform-auth.service";
import { ensurePlatformBootstrap } from "@/services/platform.service";
import {
  DEFAULT_PLATFORM_AUTH_POLL_INTERVAL_MS,
  DEFAULT_PLATFORM_AUTH_SESSION_TTL_SECONDS,
  type Env
} from "@/types/platform";
import {
  apiError,
  randomOpaqueToken,
  readClientIp,
  readJson,
  readString
} from "@/utils/platform.utils";

type BrowserAuthMode = "login" | "register";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveBrowserAuthMode(raw: string | null | undefined): BrowserAuthMode {
  return raw === "register" ? "register" : "login";
}

function buildBrowserAuthUrl(c: Context<{ Bindings: Env }>, sessionId: string, mode?: BrowserAuthMode): string {
  const url = new URL(c.req.url);
  const forwardedProto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = c.req.header("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || c.req.header("host")?.trim() || url.host;
  const protocol = forwardedProto || url.protocol.replace(/:$/, "");
  const query = new URLSearchParams({ sessionId });
  if (mode === "register") {
    query.set("mode", "register");
  }
  return `${protocol}://${host}/platform/auth/browser?${query.toString()}`;
}

async function loadPlatformAuthSession(c: Context<{ Bindings: Env }>, sessionId: string) {
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
      updatedAt: new Date().toISOString()
    });
  }
  return {
    ...session,
    status: "expired" as const
  };
}

const BROWSER_AUTH_PAGE_STYLES = `
  :root {
    color-scheme: light;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: linear-gradient(180deg, #f5f7fb 0%, #eef3ff 100%);
    color: #111827;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .shell {
    width: 100%;
    max-width: 420px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(148, 163, 184, 0.2);
    box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
    padding: 28px;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 24px;
    line-height: 1.2;
  }
  p {
    margin: 0;
    color: #475569;
    line-height: 1.6;
  }
  .header {
    margin-bottom: 20px;
  }
  .mode-switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 16px;
  }
  .mode-switch a {
    text-decoration: none;
    text-align: center;
    padding: 10px 12px;
    border-radius: 999px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    color: #334155;
    font-weight: 600;
  }
  .mode-switch a.active {
    background: #111827;
    border-color: #111827;
    color: white;
  }
  .auth-form {
    display: grid;
    gap: 14px;
  }
  label {
    display: grid;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: #0f172a;
  }
  input {
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 14px;
    padding: 12px 14px;
    font-size: 15px;
    color: #0f172a;
    background: white;
  }
  input:focus {
    outline: 2px solid #bfdbfe;
    border-color: #3b82f6;
  }
  button {
    border: 0;
    border-radius: 14px;
    padding: 13px 16px;
    font-size: 15px;
    font-weight: 700;
    color: white;
    background: linear-gradient(135deg, #111827 0%, #2563eb 100%);
    cursor: pointer;
  }
  .notice {
    border-radius: 14px;
    padding: 12px 14px;
    margin-bottom: 16px;
  }
  .notice.error {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }
  .notice.success {
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #bbf7d0;
  }
  .helper {
    margin-top: 14px;
    font-size: 14px;
  }
  .helper a {
    color: #2563eb;
    text-decoration: none;
    font-weight: 600;
  }
  .meta {
    margin-top: 12px;
    font-size: 12px;
    color: #64748b;
  }
  .state-card {
    margin-top: 16px;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    padding: 16px;
  }
`;

function getBrowserAuthHeading(pageState: "pending" | "authorized" | "expired" | "missing"): {
  title: string;
  subtitle: string;
} {
  if (pageState === "authorized") {
    return {
      title: "Authorization Complete",
      subtitle: "You can return to NextClaw. This browser page can be closed now."
    };
  }
  if (pageState === "expired") {
    return {
      title: "Authorization Expired",
      subtitle: "This authorization session has expired. Return to NextClaw and start again."
    };
  }
  if (pageState === "missing") {
    return {
      title: "Authorization Not Found",
      subtitle: "This authorization session is invalid. Return to NextClaw and start again."
    };
  }
  return {
    title: "Connect NextClaw Device",
    subtitle: "Sign in on this page to authorize the local NextClaw device."
  };
}

function renderBrowserAuthPendingContent(params: {
  sessionId: string;
  mode: BrowserAuthMode;
  expiresAt: string | null;
  email?: string;
  errorMessage?: string;
  successMessage?: string;
}): string {
  const {
    email,
    errorMessage: rawErrorMessage,
    expiresAt,
    mode,
    sessionId,
    successMessage: rawSuccessMessage
  } = params;
  const emailValue = escapeHtml(email ?? "");
  const errorMessage = rawErrorMessage ? `<div class="notice error">${escapeHtml(rawErrorMessage)}</div>` : "";
  const successMessage = rawSuccessMessage ? `<div class="notice success">${escapeHtml(rawSuccessMessage)}</div>` : "";
  const expiresText = expiresAt ? new Date(expiresAt).toLocaleString("en-US") : "-";
  const switchModeLink =
    mode === "register"
      ? `<a href="?sessionId=${encodeURIComponent(sessionId)}">Already have an account? Sign in</a>`
      : `<a href="?sessionId=${encodeURIComponent(sessionId)}&mode=register">Need an account? Create one</a>`;
  const submitLabel = mode === "register" ? "Create Account" : "Continue";
  const passwordPlaceholder = mode === "register" ? "At least 8 characters" : "Enter your password";
  return `
    ${errorMessage}
    ${successMessage}
    <div class="mode-switch">
      <a class="${mode === "login" ? "active" : ""}" href="?sessionId=${encodeURIComponent(sessionId)}">Sign In</a>
      <a class="${mode === "register" ? "active" : ""}" href="?sessionId=${encodeURIComponent(sessionId)}&mode=register">Create Account</a>
    </div>
    <form method="post" action="/platform/auth/browser/authorize" class="auth-form">
      <input type="hidden" name="sessionId" value="${escapeHtml(sessionId)}" />
      <input type="hidden" name="mode" value="${mode}" />
      <label>
        <span>Email</span>
        <input type="email" name="email" value="${emailValue}" placeholder="name@example.com" required />
      </label>
      <label>
        <span>Password</span>
        <input type="password" name="password" placeholder="${passwordPlaceholder}" required />
      </label>
      <button type="submit">${submitLabel}</button>
    </form>
    <p class="helper">${switchModeLink}</p>
    <p class="meta">Session expires at ${escapeHtml(expiresText)}.</p>
  `;
}

function renderBrowserAuthResolvedContent(params: {
  sessionId: string;
  subtitle: string;
  errorMessage?: string;
  successMessage?: string;
}): string {
  const {
    errorMessage: rawErrorMessage,
    sessionId,
    subtitle,
    successMessage: rawSuccessMessage
  } = params;
  const errorMessage = rawErrorMessage ? `<div class="notice error">${escapeHtml(rawErrorMessage)}</div>` : "";
  const successMessage = rawSuccessMessage ? `<div class="notice success">${escapeHtml(rawSuccessMessage)}</div>` : "";
  return `
    ${errorMessage}
    ${successMessage}
    <div class="state-card">
      <p>${escapeHtml(subtitle)}</p>
      <p class="meta">Session: ${escapeHtml(sessionId.slice(0, 10))}...</p>
    </div>
  `;
}

function renderBrowserAuthPage(params: {
  sessionId: string;
  mode: BrowserAuthMode;
  expiresAt: string | null;
  email?: string;
  errorMessage?: string;
  successMessage?: string;
  pageState: "pending" | "authorized" | "expired" | "missing";
}) {
  const {
    errorMessage,
    pageState,
    sessionId,
    successMessage
  } = params;
  const { title, subtitle } = getBrowserAuthHeading(pageState);
  const content = pageState === "pending"
    ? renderBrowserAuthPendingContent(params)
    : renderBrowserAuthResolvedContent({
      sessionId,
      subtitle,
      errorMessage,
      successMessage
    });

  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${BROWSER_AUTH_PAGE_STYLES}</style>
  </head>
  <body>
    <main class="shell">
      <div class="header">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      ${content}
    </main>
  </body>
</html>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    }
  );
}

export async function startBrowserAuthHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const sessionId = randomOpaqueToken();
  const expiresAt = new Date(Date.now() + DEFAULT_PLATFORM_AUTH_SESSION_TTL_SECONDS * 1000).toISOString();
  await createPlatformAuthSession(c.env.NEXTCLAW_PLATFORM_DB, {
    id: sessionId,
    expiresAt
  });
  return c.json({
    ok: true,
    data: {
      sessionId,
      verificationUri: buildBrowserAuthUrl(c, sessionId),
      expiresAt,
      intervalMs: DEFAULT_PLATFORM_AUTH_POLL_INTERVAL_MS
    }
  });
}

export async function pollBrowserAuthHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const body = await readJson(c);
  const sessionId = readString(body, "sessionId").trim();
  if (!sessionId) {
    return apiError(c, 400, "INVALID_SESSION", "sessionId is required.");
  }

  const session = await loadPlatformAuthSession(c, sessionId);
  if (!session) {
    return apiError(c, 404, "SESSION_NOT_FOUND", "Authorization session not found.");
  }
  if (session.status === "expired") {
    return c.json({
      ok: true,
      data: {
        status: "expired",
        message: "Authorization session expired."
      }
    });
  }
  if (session.status !== "authorized" || !session.user_id) {
    return c.json({
      ok: true,
      data: {
        status: "pending",
        nextPollMs: DEFAULT_PLATFORM_AUTH_POLL_INTERVAL_MS
      }
    });
  }

  const user = await getUserById(c.env.NEXTCLAW_PLATFORM_DB, session.user_id);
  if (!user) {
    return apiError(c, 404, "USER_NOT_FOUND", "Authorized account no longer exists.");
  }
  const result = await issuePlatformTokenResult({
    env: c.env,
    user
  });
  return c.json({
    ok: true,
    data: {
      status: "authorized",
      token: result.token,
      user: result.user
    }
  });
}

export async function browserAuthPageHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const sessionId = c.req.query("sessionId")?.trim() ?? "";
  const mode = resolveBrowserAuthMode(c.req.query("mode"));
  if (!sessionId) {
    return renderBrowserAuthPage({
      sessionId: "",
      mode,
      expiresAt: null,
      pageState: "missing",
      errorMessage: "Missing authorization session."
    });
  }

  const session = await loadPlatformAuthSession(c, sessionId);
  if (!session) {
    return renderBrowserAuthPage({
      sessionId,
      mode,
      expiresAt: null,
      pageState: "missing",
      errorMessage: "Authorization session not found."
    });
  }

  return renderBrowserAuthPage({
    sessionId,
    mode,
    expiresAt: session.expires_at,
    pageState: session.status
  });
}

export async function authorizeBrowserAuthHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const form = await c.req.formData();
  const sessionId = String(form.get("sessionId") ?? "").trim();
  const mode = resolveBrowserAuthMode(String(form.get("mode") ?? ""));
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!sessionId) {
    return renderBrowserAuthPage({
      sessionId: "",
      mode,
      expiresAt: null,
      email,
      pageState: "missing",
      errorMessage: "Missing authorization session."
    });
  }

  const session = await loadPlatformAuthSession(c, sessionId);
  if (!session) {
    return renderBrowserAuthPage({
      sessionId,
      mode,
      expiresAt: null,
      email,
      pageState: "missing",
      errorMessage: "Authorization session not found."
    });
  }
  if (session.status === "authorized") {
    return renderBrowserAuthPage({
      sessionId,
      mode,
      expiresAt: session.expires_at,
      email,
      pageState: "authorized",
      successMessage: "This device is already authorized."
    });
  }
  if (session.status === "expired") {
    return renderBrowserAuthPage({
      sessionId,
      mode,
      expiresAt: session.expires_at,
      email,
      pageState: "expired",
      errorMessage: "Authorization session expired."
    });
  }

  try {
    const user = mode === "register"
      ? await registerPlatformUser({
        env: c.env,
        email,
        password
      })
      : await authenticatePlatformUser({
        env: c.env,
        email,
        password,
        clientIp: readClientIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for"))
      });

    await updatePlatformAuthSessionStatus(c.env.NEXTCLAW_PLATFORM_DB, {
      id: session.id,
      status: "authorized",
      userId: user.id,
      updatedAt: new Date().toISOString()
    });

    return renderBrowserAuthPage({
      sessionId,
      mode,
      expiresAt: session.expires_at,
      email,
      pageState: "authorized",
      successMessage: "Authorization completed. You can close this page now. NextClaw should finish this device login automatically."
    });
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return renderBrowserAuthPage({
        sessionId,
        mode,
        expiresAt: session.expires_at,
        email,
        pageState: "pending",
        errorMessage: error.message
      });
    }
    throw error;
  }
}
