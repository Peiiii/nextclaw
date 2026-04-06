import type { Context } from "hono";
import type { UiAuthService } from "../auth.service.js";
import { ensureUiBridgeSecret } from "../auth-bridge.js";
import type {
  AuthEnabledUpdateRequest,
  AuthLoginRequest,
  AuthPasswordUpdateRequest,
  AuthSetupRequest
} from "../types.js";
import { err, ok, readJson } from "./response.js";

function isAuthenticationRequiredError(message: string): boolean {
  return message === "Authentication required.";
}

function isConflictError(message: string): boolean {
  return message.includes("already configured");
}

function setCookieHeader(c: Context, cookie: string | undefined): void {
  if (!cookie) {
    return;
  }
  c.header("Set-Cookie", cookie);
}

export class AuthRoutesController {
  constructor(private readonly authService: UiAuthService) {}

  readonly getStatus = (c: Context) => {
    return c.json(ok(this.authService.getStatus(c.req.raw)));
  };

  readonly setup = async (c: Context) => {
    const body = await readJson<AuthSetupRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (typeof body.data.username !== "string" || typeof body.data.password !== "string") {
      return c.json(err("INVALID_BODY", "username and password are required"), 400);
    }

    try {
      const result = this.authService.setup(c.req.raw, body.data);
      setCookieHeader(c, result.cookie);
      return c.json(ok(result.status), 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json(err(isConflictError(message) ? "AUTH_ALREADY_CONFIGURED" : "INVALID_BODY", message), isConflictError(message) ? 409 : 400);
    }
  };

  readonly login = async (c: Context) => {
    const body = await readJson<AuthLoginRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (typeof body.data.username !== "string" || typeof body.data.password !== "string") {
      return c.json(err("INVALID_BODY", "username and password are required"), 400);
    }

    try {
      const result = this.authService.login(c.req.raw, body.data);
      setCookieHeader(c, result.cookie);
      return c.json(ok(result.status));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = message === "Invalid username or password." ? "INVALID_CREDENTIALS" : "AUTH_NOT_ENABLED";
      const status = message === "Invalid username or password." ? 401 : 400;
      return c.json(err(code, message), status);
    }
  };

  readonly logout = (c: Context) => {
    this.authService.logout(c.req.raw);
    setCookieHeader(c, this.authService.buildLogoutCookie(c.req.raw));
    return c.json(ok({ success: true }));
  };

  readonly updatePassword = async (c: Context) => {
    const body = await readJson<AuthPasswordUpdateRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (typeof body.data.password !== "string") {
      return c.json(err("INVALID_BODY", "password is required"), 400);
    }

    try {
      const result = this.authService.updatePassword(c.req.raw, body.data);
      setCookieHeader(c, result.cookie);
      return c.json(ok(result.status));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = isAuthenticationRequiredError(message) ? 401 : 400;
      const code = isAuthenticationRequiredError(message) ? "UNAUTHORIZED" : "INVALID_BODY";
      return c.json(err(code, message), status);
    }
  };

  readonly updateEnabled = async (c: Context) => {
    const body = await readJson<AuthEnabledUpdateRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    if (typeof body.data.enabled !== "boolean") {
      return c.json(err("INVALID_BODY", "enabled is required"), 400);
    }

    try {
      const result = this.authService.updateEnabled(c.req.raw, body.data);
      setCookieHeader(c, result.cookie);
      return c.json(ok(result.status));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = isAuthenticationRequiredError(message) ? 401 : 400;
      const code = isAuthenticationRequiredError(message) ? "UNAUTHORIZED" : "INVALID_BODY";
      return c.json(err(code, message), status);
    }
  };

  readonly issueBridgeSession = (c: Context) => {
    const providedSecret = c.req.header("x-nextclaw-ui-bridge-secret")?.trim();
    const expectedSecret = ensureUiBridgeSecret();
    if (!providedSecret || providedSecret !== expectedSecret) {
      return c.json(err("FORBIDDEN", "Invalid bridge secret."), 403);
    }
    return c.json(ok({
      cookie: this.authService.buildTrustedRequestCookieHeader()
    }));
  };
}
