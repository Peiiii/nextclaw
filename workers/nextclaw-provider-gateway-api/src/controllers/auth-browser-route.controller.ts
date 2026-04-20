import type { Context } from "hono";
import { getUserById } from "@/repositories/platform.repository";
import {
  renderBrowserAuthPage,
  resolveBrowserAuthLocale,
  resolveBrowserAuthMode,
  type BrowserAuthLocale,
} from "@/services/auth-browser/auth-browser-page-renderer.service.js";
import {
  authorizeBrowserSessionForUser,
  createBrowserAuthSession,
  loadPendingBrowserAuthSession,
  loadPlatformAuthSession,
  renderMissingSessionPage,
} from "@/services/auth-browser/auth-browser-session.service.js";
import { sendPlatformEmailAuthCode, verifyPlatformEmailAuthCode } from "@/services/platform/platform-email-otp.service";
import {
  authenticatePlatformUser,
  isPlatformAuthServiceError,
  issuePlatformTokenResult,
  registerPlatformUser,
  updatePlatformUserPassword,
} from "@/services/platform/platform-auth.service";
import { ensurePlatformBootstrap } from "@/services/platform.service";
import { DEFAULT_PLATFORM_AUTH_POLL_INTERVAL_MS, type Env } from "@/types/platform";
import { apiError, readClientIp, readJson, readString } from "@/utils/platform.utils";

function resolveRequestBrowserAuthLocale(
  c: Context<{ Bindings: Env }>,
  explicitLocale?: string | null,
): BrowserAuthLocale {
  return resolveBrowserAuthLocale({
    explicitLocale,
    cookieHeader: c.req.header("cookie"),
    acceptLanguageHeader: c.req.header("accept-language"),
  });
}

export async function startBrowserAuthHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const session = await createBrowserAuthSession(c);
  return c.json({
    ok: true,
    data: session,
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
        message: "Authorization session expired.",
      },
    });
  }
  if (session.status !== "authorized" || !session.user_id) {
    return c.json({
      ok: true,
      data: {
        status: "pending",
        nextPollMs: DEFAULT_PLATFORM_AUTH_POLL_INTERVAL_MS,
      },
    });
  }

  const user = await getUserById(c.env.NEXTCLAW_PLATFORM_DB, session.user_id);
  if (!user) {
    return apiError(c, 404, "USER_NOT_FOUND", "Authorized account no longer exists.");
  }
  const result = await issuePlatformTokenResult({
    env: c.env,
    user,
  });
  return c.json({
    ok: true,
    data: {
      status: "authorized",
      token: result.token,
      user: result.user,
    },
  });
}

export async function browserAuthPageHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const sessionId = c.req.query("sessionId")?.trim() ?? "";
  const mode = resolveBrowserAuthMode(c.req.query("mode"));
  const locale = resolveRequestBrowserAuthLocale(c, c.req.query("locale"));
  if (!sessionId) {
    return renderMissingSessionPage(locale);
  }

  const session = await loadPlatformAuthSession(c, sessionId);
  if (!session) {
    return renderBrowserAuthPage({
      sessionId,
      pageState: "missing",
      expiresAt: null,
      mode,
      locale,
      errorCode: "SESSION_NOT_FOUND",
    });
  }

  return renderBrowserAuthPage({
    sessionId,
    pageState: session.status,
    expiresAt: session.expires_at,
    mode,
    locale,
  });
}

export async function loginBrowserAuthHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const form = await c.req.formData();
  const sessionId = String(form.get("sessionId") ?? "").trim();
  const locale = resolveRequestBrowserAuthLocale(c, String(form.get("locale") ?? "").trim());
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const sessionResult = await loadPendingBrowserAuthSession(c, sessionId, "login", locale, email);
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  const clientIp = readClientIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for"));
  try {
    const user = await authenticatePlatformUser({
      env: c.env,
      email,
      password,
      clientIp,
    });
    await authorizeBrowserSessionForUser({
      env: c.env,
      sessionId: sessionResult.session.id,
      userId: user.id,
    });
    return renderBrowserAuthPage({
      sessionId,
      pageState: "authorized",
      expiresAt: sessionResult.session.expires_at,
      mode: "login",
      locale,
      email,
      successCode: "DEVICE_LINKED",
    });
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return renderBrowserAuthPage({
        sessionId,
        pageState: "pending",
        expiresAt: sessionResult.session.expires_at,
        mode: "login",
        locale,
        email,
        errorCode: error.code,
        errorMessage: error.message,
      });
    }
    throw error;
  }
}

export async function sendBrowserRegisterCodeHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const form = await c.req.formData();
  const sessionId = String(form.get("sessionId") ?? "").trim();
  const locale = resolveRequestBrowserAuthLocale(c, String(form.get("locale") ?? "").trim());
  const email = String(form.get("email") ?? "").trim();
  const sessionResult = await loadPendingBrowserAuthSession(c, sessionId, "register", locale, email);
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  try {
    const result = await sendPlatformEmailAuthCode({
      env: c.env,
      email,
      clientIp: readClientIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
      purpose: "register",
      browserAuthSessionId: sessionResult.session.id,
    });
    return renderBrowserAuthPage({
      sessionId,
      pageState: "pending",
      expiresAt: sessionResult.session.expires_at,
      mode: "register",
      locale,
      email: result.email,
      maskedEmail: result.maskedEmail,
      codeStepActive: true,
      successCode: "VERIFICATION_CODE_SENT",
    });
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return renderBrowserAuthPage({
        sessionId,
        pageState: "pending",
        expiresAt: sessionResult.session.expires_at,
        mode: "register",
        locale,
        email,
        errorCode: error.code,
        errorMessage: error.message,
      });
    }
    throw error;
  }
}

export async function completeBrowserRegisterHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const form = await c.req.formData();
  const sessionId = String(form.get("sessionId") ?? "").trim();
  const locale = resolveRequestBrowserAuthLocale(c, String(form.get("locale") ?? "").trim());
  const email = String(form.get("email") ?? "").trim();
  const code = String(form.get("code") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const sessionResult = await loadPendingBrowserAuthSession(c, sessionId, "register", locale, email);
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  try {
    const verified = await verifyPlatformEmailAuthCode({
      env: c.env,
      email,
      code,
      purpose: "register",
      browserAuthSessionId: sessionResult.session.id,
    });
    const user = await registerPlatformUser({
      env: c.env,
      email: verified.email,
      password,
    });
    await authorizeBrowserSessionForUser({
      env: c.env,
      sessionId: sessionResult.session.id,
      userId: user.id,
    });
    return renderBrowserAuthPage({
      sessionId,
      pageState: "authorized",
      expiresAt: sessionResult.session.expires_at,
      mode: "register",
      locale,
      email,
      successCode: "ACCOUNT_CREATED_AND_AUTHORIZED",
    });
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return renderBrowserAuthPage({
        sessionId,
        pageState: "pending",
        expiresAt: sessionResult.session.expires_at,
        mode: "register",
        locale,
        email,
        codeStepActive: true,
        errorCode: error.code,
        errorMessage: error.message,
      });
    }
    throw error;
  }
}

export async function sendBrowserPasswordResetCodeHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const form = await c.req.formData();
  const sessionId = String(form.get("sessionId") ?? "").trim();
  const locale = resolveRequestBrowserAuthLocale(c, String(form.get("locale") ?? "").trim());
  const email = String(form.get("email") ?? "").trim();
  const sessionResult = await loadPendingBrowserAuthSession(c, sessionId, "reset_password", locale, email);
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  try {
    const result = await sendPlatformEmailAuthCode({
      env: c.env,
      email,
      clientIp: readClientIp(c.req.header("cf-connecting-ip"), c.req.header("x-forwarded-for")),
      purpose: "password_reset",
      browserAuthSessionId: sessionResult.session.id,
    });
    return renderBrowserAuthPage({
      sessionId,
      pageState: "pending",
      expiresAt: sessionResult.session.expires_at,
      mode: "reset_password",
      locale,
      email: result.email,
      maskedEmail: result.maskedEmail,
      codeStepActive: true,
      successCode: "VERIFICATION_CODE_SENT",
    });
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return renderBrowserAuthPage({
        sessionId,
        pageState: "pending",
        expiresAt: sessionResult.session.expires_at,
        mode: "reset_password",
        locale,
        email,
        errorCode: error.code,
        errorMessage: error.message,
      });
    }
    throw error;
  }
}

export async function completeBrowserPasswordResetHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  await ensurePlatformBootstrap(c.env);
  const form = await c.req.formData();
  const sessionId = String(form.get("sessionId") ?? "").trim();
  const locale = resolveRequestBrowserAuthLocale(c, String(form.get("locale") ?? "").trim());
  const email = String(form.get("email") ?? "").trim();
  const code = String(form.get("code") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const sessionResult = await loadPendingBrowserAuthSession(c, sessionId, "reset_password", locale, email);
  if (!sessionResult.ok) {
    return sessionResult.response;
  }

  try {
    const verified = await verifyPlatformEmailAuthCode({
      env: c.env,
      email,
      code,
      purpose: "password_reset",
      browserAuthSessionId: sessionResult.session.id,
    });
    const user = await updatePlatformUserPassword({
      env: c.env,
      email: verified.email,
      password,
    });
    await authorizeBrowserSessionForUser({
      env: c.env,
      sessionId: sessionResult.session.id,
      userId: user.id,
    });
    return renderBrowserAuthPage({
      sessionId,
      pageState: "authorized",
      expiresAt: sessionResult.session.expires_at,
      mode: "reset_password",
      locale,
      email,
      successCode: "PASSWORD_RESET_AND_AUTHORIZED",
    });
  } catch (error) {
    if (isPlatformAuthServiceError(error)) {
      return renderBrowserAuthPage({
        sessionId,
        pageState: "pending",
        expiresAt: sessionResult.session.expires_at,
        mode: "reset_password",
        locale,
        email,
        codeStepActive: true,
        errorCode: error.code,
        errorMessage: error.message,
      });
    }
    throw error;
  }
}
