import type { IncomingMessage } from "node:http";
import type { AccessManager, AccessLoginResult } from "@nextclaw/kernel";
import type {
  AuthEnabledUpdateRequest,
  AuthLoginRequest,
  AuthPasswordUpdateRequest,
  AuthSetupRequest,
  AuthStatusView,
} from "@nextclaw-server/shared/types/server-api.types.js";
import {
  buildAccessLoginCookie,
  buildAccessLogoutCookie,
  readAccessSessionTokenFromCookieHeader,
  resolveSecureRequest,
} from "@nextclaw-server/features/auth/utils/access-cookie.utils.js";

export class UiAuthService {
  constructor(private readonly accessManager: AccessManager) {}

  isProtectionEnabled = (): boolean => this.accessManager.isPasswordProtectionEnabled();

  isRequestAuthenticated = (request: Request): boolean => {
    if (!this.isProtectionEnabled()) {
      return true;
    }
    return this.accessManager.authenticateSession(this.readRequestToken(request)) !== null;
  };

  isSocketAuthenticated = (request: IncomingMessage): boolean => {
    if (!this.isProtectionEnabled()) {
      return true;
    }
    const rawCookieHeader = Array.isArray(request.headers.cookie)
      ? request.headers.cookie.join("; ")
      : request.headers.cookie;
    return this.accessManager.authenticateSession(readAccessSessionTokenFromCookieHeader(rawCookieHeader)) !== null;
  };

  getStatus = (request: Request): AuthStatusView => {
    return this.accessManager.getPasswordAuthStatus(this.readRequestToken(request));
  };

  setup = async (request: Request, payload: AuthSetupRequest): Promise<{ status: AuthStatusView; cookie: string }> => {
    return this.toCookieResult(request, await this.accessManager.setupPasswordAdmin(payload));
  };

  login = (request: Request, payload: AuthLoginRequest): { status: AuthStatusView; cookie: string } => {
    return this.toCookieResult(request, this.accessManager.loginWithPassword(payload));
  };

  logout = (request: Request): void => {
    this.accessManager.logout(this.readRequestToken(request));
  };

  updatePassword = async (
    request: Request,
    payload: AuthPasswordUpdateRequest,
  ): Promise<{ status: AuthStatusView; cookie?: string }> => {
    return this.toOptionalCookieResult(
      request,
      await this.accessManager.updatePassword({
        token: this.readRequestToken(request),
        password: payload.password,
      }),
    );
  };

  updateEnabled = async (
    request: Request,
    payload: AuthEnabledUpdateRequest,
  ): Promise<{ status: AuthStatusView; cookie?: string }> => {
    const result = await this.accessManager.setPasswordAuthEnabled({
      token: this.readRequestToken(request),
      enabled: payload.enabled,
    });
    if (!payload.enabled) {
      return {
        status: result.status,
        cookie: this.buildLogoutCookie(request),
      };
    }
    return this.toOptionalCookieResult(request, result);
  };

  buildTrustedRequestCookieHeader = (): string | null => {
    const result = this.accessManager.createTrustedSession();
    return result?.token ? `nextclaw_ui_session=${encodeURIComponent(result.token)}` : null;
  };

  buildLogoutCookie = (request: Request): string => {
    return buildAccessLogoutCookie(this.isSecureRequest(request));
  };

  private readRequestToken = (request: Request): string | null => {
    return readAccessSessionTokenFromCookieHeader(request.headers.get("cookie"));
  };

  private toCookieResult = (
    request: Request,
    result: AccessLoginResult,
  ): { status: AuthStatusView; cookie: string } => {
    if (!result.token) {
      throw new Error("Access session token was not created.");
    }
    return {
      status: result.status,
      cookie: buildAccessLoginCookie({
        token: result.token,
        secure: this.isSecureRequest(request),
        expiresAt: result.expiresAt,
      }),
    };
  };

  private toOptionalCookieResult = (
    request: Request,
    result: AccessLoginResult,
  ): { status: AuthStatusView; cookie?: string } => {
    if (!result.token) {
      return {
        status: result.status,
      };
    }
    return this.toCookieResult(request, result);
  };

  private isSecureRequest = (request: Request): boolean => {
    return resolveSecureRequest(request.url, request.headers.get("x-forwarded-proto"));
  };
}

