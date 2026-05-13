import { ConfigSchema, loadConfig, saveConfig, type Config } from "@nextclaw/core";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type {
  AuthEnabledUpdateRequest,
  AuthLoginRequest,
  AuthPasswordUpdateRequest,
  AuthSetupRequest,
  AuthStatusView
} from "@nextclaw-server/shared/types/server-api.types.js";

const SESSION_COOKIE_NAME = "nextclaw_ui_session";
const PASSWORD_MIN_LENGTH = 8;

type AuthSessionRecord = {
  sessionId: string;
  username: string;
  createdAt: number;
};

type UiAuthConfig = Config["ui"]["auth"];

function normalizeUsername(value: string): string {
  return value.trim();
}

function parseCookieHeader(rawHeader: string | null | undefined): Record<string, string> {
  if (!rawHeader) {
    return {};
  }
  const cookies: Record<string, string> = {};
  for (const chunk of rawHeader.split(";")) {
    const [rawKey, ...rawValue] = chunk.split("=");
    const key = rawKey?.trim();
    if (!key) {
      continue;
    }
    cookies[key] = decodeURIComponent(rawValue.join("=").trim());
  }
  return cookies;
}

function buildSetCookie(params: {
  value: string;
  secure: boolean;
  maxAgeSeconds?: number;
  expires?: string;
}): string {
  const { value, secure, maxAgeSeconds, expires } = params;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];
  if (secure) {
    parts.push("Secure");
  }
  if (typeof maxAgeSeconds === "number") {
    parts.push(`Max-Age=${Math.max(0, Math.trunc(maxAgeSeconds))}`);
  }
  if (expires) {
    parts.push(`Expires=${expires}`);
  }
  return parts.join("; ");
}

function resolveSecureRequest(url: string, protocolHint?: string | null): boolean {
  if (protocolHint?.trim().toLowerCase() === "https") {
    return true;
  }
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function verifyPassword(password: string, expectedHash: string, salt: string): boolean {
  const actualHashBuffer = Buffer.from(hashPassword(password, salt), "hex");
  const expectedHashBuffer = Buffer.from(expectedHash, "hex");
  if (actualHashBuffer.length !== expectedHashBuffer.length) {
    return false;
  }
  return timingSafeEqual(actualHashBuffer, expectedHashBuffer);
}

function createPasswordRecord(password: string): { passwordHash: string; passwordSalt: string } {
  const passwordSalt = randomBytes(16).toString("hex");
  return {
    passwordHash: hashPassword(password, passwordSalt),
    passwordSalt
  };
}

function validateUsernameAndPassword(username: string, password: string): void {
  if (!username) {
    throw new Error("Username is required.");
  }
  if (password.trim().length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
}

export class UiAuthService {
  private readonly sessions = new Map<string, AuthSessionRecord>();

  constructor(private readonly configPath: string) {}

  private loadCurrentConfig = (): Config => {
    return loadConfig(this.configPath);
  }

  private saveCurrentConfig = (config: Config): void => {
    saveConfig(ConfigSchema.parse(config), this.configPath);
  }

  private readAuthConfig = (): UiAuthConfig => {
    return this.loadCurrentConfig().ui.auth;
  }

  private isConfigured = (auth: UiAuthConfig): boolean => {
    return Boolean(
      normalizeUsername(auth.username).length > 0 &&
      auth.passwordHash.trim().length > 0 &&
      auth.passwordSalt.trim().length > 0
    );
  }

  isProtectionEnabled = (): boolean => {
    const auth = this.readAuthConfig();
    return Boolean(auth.enabled && this.isConfigured(auth));
  }

  private getSessionIdFromCookieHeader = (rawCookieHeader: string | null | undefined): string | null => {
    const cookies = parseCookieHeader(rawCookieHeader);
    const sessionId = cookies[SESSION_COOKIE_NAME];
    return sessionId?.trim() ? sessionId.trim() : null;
  }

  private getValidSession = (sessionId: string | null, username: string): AuthSessionRecord | null => {
    if (!sessionId) {
      return null;
    }
    const session = this.sessions.get(sessionId);
    if (!session || session.username !== username) {
      return null;
    }
    return session;
  }

  isRequestAuthenticated = (request: Request): boolean => {
    const auth = this.readAuthConfig();
    if (!auth.enabled || !this.isConfigured(auth)) {
      return true;
    }
    const username = normalizeUsername(auth.username);
    const sessionId = this.getSessionIdFromCookieHeader(request.headers.get("cookie"));
    return Boolean(this.getValidSession(sessionId, username));
  }

  isSocketAuthenticated = (request: IncomingMessage): boolean => {
    const auth = this.readAuthConfig();
    if (!auth.enabled || !this.isConfigured(auth)) {
      return true;
    }
    const username = normalizeUsername(auth.username);
    const rawCookieHeader = Array.isArray(request.headers.cookie)
      ? request.headers.cookie.join("; ")
      : request.headers.cookie;
    const sessionId = this.getSessionIdFromCookieHeader(rawCookieHeader);
    return Boolean(this.getValidSession(sessionId, username));
  }

  getStatus = (request: Request): AuthStatusView => {
    const auth = this.readAuthConfig();
    const configured = this.isConfigured(auth);
    const enabled = Boolean(auth.enabled && configured);
    const username = configured ? normalizeUsername(auth.username) : undefined;
    return {
      enabled,
      configured,
      authenticated: enabled ? this.isRequestAuthenticated(request) : false,
      ...(username ? { username } : {})
    };
  }

  private createSession = (username: string): string => {
    const sessionId = randomUUID();
    this.sessions.set(sessionId, {
      sessionId,
      username,
      createdAt: Date.now()
    });
    return sessionId;
  }

  private clearAllSessions = (): void => {
    this.sessions.clear();
  }

  private deleteRequestSession = (request: Request): void => {
    const sessionId = this.getSessionIdFromCookieHeader(request.headers.get("cookie"));
    if (!sessionId) {
      return;
    }
    this.sessions.delete(sessionId);
  }

  private buildLoginCookie = (request: Request, sessionId: string): string => {
    return buildSetCookie({
      value: sessionId,
      secure: resolveSecureRequest(request.url, request.headers.get("x-forwarded-proto"))
    });
  }

  buildTrustedRequestCookieHeader = (): string | null => {
    const auth = this.readAuthConfig();
    if (!auth.enabled || !this.isConfigured(auth)) {
      return null;
    }
    const username = normalizeUsername(auth.username);
    if (!username) {
      return null;
    }
    const sessionId = this.createSession(username);
    return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}`;
  }

  buildLogoutCookie = (request: Request): string => {
    return buildSetCookie({
      value: "",
      secure: resolveSecureRequest(request.url, request.headers.get("x-forwarded-proto")),
      maxAgeSeconds: 0,
      expires: new Date(0).toUTCString()
    });
  }

  setup = (request: Request, payload: AuthSetupRequest): { status: AuthStatusView; cookie: string } => {
    const config = this.loadCurrentConfig();
    const currentAuth = config.ui.auth;
    if (this.isConfigured(currentAuth)) {
      throw new Error("UI authentication is already configured.");
    }

    const username = normalizeUsername(payload.username);
    const password = payload.password;
    validateUsernameAndPassword(username, password);

    const nextPassword = createPasswordRecord(password);
    config.ui.auth = {
      enabled: true,
      username,
      ...nextPassword
    };
    this.saveCurrentConfig(config);

    this.clearAllSessions();
    const sessionId = this.createSession(username);
    return {
      status: {
        enabled: true,
        configured: true,
        authenticated: true,
        username
      },
      cookie: this.buildLoginCookie(request, sessionId)
    };
  }

  login = (request: Request, payload: AuthLoginRequest): { status: AuthStatusView; cookie: string } => {
    const auth = this.readAuthConfig();
    if (!auth.enabled || !this.isConfigured(auth)) {
      throw new Error("UI authentication is not enabled.");
    }

    const username = normalizeUsername(payload.username);
    if (username !== normalizeUsername(auth.username) || !verifyPassword(payload.password, auth.passwordHash, auth.passwordSalt)) {
      throw new Error("Invalid username or password.");
    }

    const sessionId = this.createSession(username);
    return {
      status: {
        enabled: true,
        configured: true,
        authenticated: true,
        username
      },
      cookie: this.buildLoginCookie(request, sessionId)
    };
  }

  logout = (request: Request): void => {
    this.deleteRequestSession(request);
  }

  updatePassword = (request: Request, payload: AuthPasswordUpdateRequest): { status: AuthStatusView; cookie?: string } => {
    const config = this.loadCurrentConfig();
    const auth = config.ui.auth;
    if (!this.isConfigured(auth)) {
      throw new Error("UI authentication is not configured.");
    }
    if (auth.enabled && !this.isRequestAuthenticated(request)) {
      throw new Error("Authentication required.");
    }

    validateUsernameAndPassword(normalizeUsername(auth.username), payload.password);

    const nextPassword = createPasswordRecord(payload.password);
    config.ui.auth = {
      ...auth,
      ...nextPassword
    };
    this.saveCurrentConfig(config);

    this.clearAllSessions();

    if (!auth.enabled) {
      return {
        status: {
          enabled: false,
          configured: true,
          authenticated: false,
          username: normalizeUsername(auth.username)
        }
      };
    }

    const sessionId = this.createSession(normalizeUsername(auth.username));
    return {
      status: {
        enabled: true,
        configured: true,
        authenticated: true,
        username: normalizeUsername(auth.username)
      },
      cookie: this.buildLoginCookie(request, sessionId)
    };
  }

  updateEnabled = (request: Request, payload: AuthEnabledUpdateRequest): { status: AuthStatusView; cookie?: string } => {
    const config = this.loadCurrentConfig();
    const auth = config.ui.auth;
    const configured = this.isConfigured(auth);
    const currentlyEnabled = Boolean(auth.enabled && configured);

    if (currentlyEnabled && !this.isRequestAuthenticated(request)) {
      throw new Error("Authentication required.");
    }

    if (payload.enabled && !configured) {
      throw new Error("UI authentication must be configured before it can be enabled.");
    }

    config.ui.auth = {
      ...auth,
      enabled: Boolean(payload.enabled)
    };
    this.saveCurrentConfig(config);

    if (!payload.enabled) {
      this.clearAllSessions();
      return {
        status: {
          enabled: false,
          configured,
          authenticated: false,
          ...(configured ? { username: normalizeUsername(auth.username) } : {})
        },
        cookie: this.buildLogoutCookie(request)
      };
    }

    const username = normalizeUsername(auth.username);
    const sessionId = this.createSession(username);
    return {
      status: {
        enabled: true,
        configured: true,
        authenticated: true,
        username
      },
      cookie: this.buildLoginCookie(request, sessionId)
    };
  }
}
