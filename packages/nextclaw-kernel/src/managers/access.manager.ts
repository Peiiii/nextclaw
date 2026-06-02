import { ConfigSchema, getConfigPath, getDataDir, loadConfig, saveConfig, type Config } from "@nextclaw/core";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import { AccessSessionStore } from "@kernel/stores/access-session.store.js";
import type {
  AccessLoginResult,
  AccessPasswordStatus,
  AccessPrincipal,
  AccessSessionRecord,
} from "@kernel/types/access.types.js";
import { createAccessPasswordRecord, verifyAccessPassword } from "@kernel/utils/access-password.utils.js";
import { createAccessSessionToken, hashAccessSessionToken } from "@kernel/utils/access-token.utils.js";
import { dirname, resolve } from "node:path";

const PASSWORD_MIN_LENGTH = 8;
const DEFAULT_ACCESS_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type AccessAuthConfig = Config["ui"]["auth"];

export type AccessManagerOptions = {
  configManager?: ConfigManager;
  configPath?: string;
  homeDir?: string;
  sessionStorePath?: string;
  sessionTtlMs?: number;
  now?: () => Date;
};

function normalizeUsername(value: string): string {
  return value.trim();
}

function validateUsernameAndPassword(username: string, password: string): void {
  if (!username) {
    throw new Error("Username is required.");
  }
  if (password.trim().length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
}

function resolveAccessSessionStorePath(options: AccessManagerOptions): string {
  const { configPath, homeDir, sessionStorePath } = options;
  if (sessionStorePath?.trim()) {
    return sessionStorePath.trim();
  }
  if (homeDir?.trim()) {
    return resolve(homeDir.trim(), "access", "access-sessions.json");
  }
  if (configPath?.trim()) {
    return resolve(dirname(configPath.trim()), "access", "access-sessions.json");
  }
  return resolve(getDataDir(), "access", "access-sessions.json");
}

export class AccessManager {
  readonly sessions: AccessSessionStore;
  private readonly configPath: string;
  private readonly sessionTtlMs: number;
  private readonly now: () => Date;

  constructor(private readonly options: AccessManagerOptions = {}) {
    this.configPath = options.configManager?.configPath ?? options.configPath ?? getConfigPath();
    this.sessions = new AccessSessionStore(resolveAccessSessionStorePath({
      ...options,
      configPath: this.configPath,
    }));
    this.sessionTtlMs = Math.max(1, Math.trunc(options.sessionTtlMs ?? DEFAULT_ACCESS_SESSION_TTL_MS));
    this.now = options.now ?? (() => new Date());
  }

  isPasswordProtectionEnabled = (): boolean => {
    const auth = this.readAuthConfig();
    return Boolean(auth.enabled && this.isConfigured(auth));
  };

  authenticateSession = (token: string | null | undefined): AccessPrincipal | null => {
    const auth = this.readAuthConfig();
    if (!auth.enabled || !this.isConfigured(auth)) {
      return { id: "admin", role: "admin" };
    }
    return this.sessions.findPrincipalByToken(token, this.now());
  };

  getPasswordAuthStatus = (token: string | null | undefined): AccessPasswordStatus => {
    const auth = this.readAuthConfig();
    const configured = this.isConfigured(auth);
    const enabled = Boolean(auth.enabled && configured);
    const username = configured ? normalizeUsername(auth.username) : undefined;
    return {
      enabled,
      configured,
      authenticated: enabled ? this.sessions.findPrincipalByToken(token, this.now()) !== null : false,
      username,
    };
  };

  setupPasswordAdmin = async (input: { username: string; password: string }): Promise<AccessLoginResult> => {
    const config = this.loadCurrentConfig();
    const currentAuth = config.ui.auth;
    if (this.isConfigured(currentAuth)) {
      throw new Error("UI authentication is already configured.");
    }

    const username = normalizeUsername(input.username);
    validateUsernameAndPassword(username, input.password);

    const nextPassword = createAccessPasswordRecord(input.password);
    config.ui.auth = {
      enabled: true,
      username,
      passwordHash: nextPassword.passwordHash,
      passwordSalt: nextPassword.passwordSalt,
    };
    await this.saveCurrentConfig(config, "setup password access");

    this.sessions.clear();
    return this.createLoginResult(username, true);
  };

  loginWithPassword = (input: { username: string; password: string }): AccessLoginResult => {
    const auth = this.readAuthConfig();
    if (!auth.enabled || !this.isConfigured(auth)) {
      throw new Error("UI authentication is not enabled.");
    }

    const username = normalizeUsername(input.username);
    if (username !== normalizeUsername(auth.username) || !verifyAccessPassword(input.password, auth.passwordHash, auth.passwordSalt)) {
      throw new Error("Invalid username or password.");
    }

    return this.createLoginResult(username, true);
  };

  logout = (token: string | null | undefined): void => {
    this.sessions.deleteToken(token);
  };

  updatePassword = async (input: { token: string | null | undefined; password: string }): Promise<AccessLoginResult> => {
    const config = this.loadCurrentConfig();
    const auth = config.ui.auth;
    if (!this.isConfigured(auth)) {
      throw new Error("UI authentication is not configured.");
    }
    if (auth.enabled && this.sessions.findPrincipalByToken(input.token, this.now()) === null) {
      throw new Error("Authentication required.");
    }

    const username = normalizeUsername(auth.username);
    validateUsernameAndPassword(username, input.password);

    const nextPassword = createAccessPasswordRecord(input.password);
    config.ui.auth = {
      enabled: auth.enabled,
      username: auth.username,
      passwordHash: nextPassword.passwordHash,
      passwordSalt: nextPassword.passwordSalt,
    };
    await this.saveCurrentConfig(config, "update password access");

    this.sessions.clear();
    if (!auth.enabled) {
      return {
        status: {
          enabled: false,
          configured: true,
          authenticated: false,
          username,
        },
      };
    }

    return this.createLoginResult(username, true);
  };

  setPasswordAuthEnabled = async (input: {
    token: string | null | undefined;
    enabled: boolean;
  }): Promise<AccessLoginResult> => {
    const config = this.loadCurrentConfig();
    const auth = config.ui.auth;
    const configured = this.isConfigured(auth);
    const currentlyEnabled = Boolean(auth.enabled && configured);

    if (currentlyEnabled && this.sessions.findPrincipalByToken(input.token, this.now()) === null) {
      throw new Error("Authentication required.");
    }

    if (input.enabled && !configured) {
      throw new Error("UI authentication must be configured before it can be enabled.");
    }

    config.ui.auth = {
      enabled: Boolean(input.enabled),
      username: auth.username,
      passwordHash: auth.passwordHash,
      passwordSalt: auth.passwordSalt,
    };
    await this.saveCurrentConfig(config, "update password access enabled");

    if (!input.enabled) {
      this.sessions.clear();
      return {
        status: {
          enabled: false,
          configured,
          authenticated: false,
          username: configured ? normalizeUsername(auth.username) : undefined,
        },
      };
    }

    return this.createLoginResult(normalizeUsername(auth.username), true);
  };

  createTrustedSession = (): AccessLoginResult | null => {
    const auth = this.readAuthConfig();
    if (!auth.enabled || !this.isConfigured(auth)) {
      return null;
    }
    return this.createLoginResult(normalizeUsername(auth.username), true);
  };

  private loadCurrentConfig = (): Config => {
    return this.options.configManager?.loadConfig() ?? loadConfig(this.configPath);
  };

  private saveCurrentConfig = async (config: Config, note: string): Promise<void> => {
    const parsed = ConfigSchema.parse(config);
    if (this.options.configManager) {
      await this.options.configManager.applyConfig(parsed, note);
      return;
    }
    saveConfig(parsed, this.configPath);
  };

  private readAuthConfig = (): AccessAuthConfig => {
    return this.loadCurrentConfig().ui.auth;
  };

  private isConfigured = (auth: AccessAuthConfig): boolean => {
    return Boolean(
      normalizeUsername(auth.username).length > 0 &&
      auth.passwordHash.trim().length > 0 &&
      auth.passwordSalt.trim().length > 0
    );
  };

  private createLoginResult = (username: string, authenticated: boolean): AccessLoginResult => {
    const session = this.createSession(username);
    return {
      status: {
        enabled: true,
        configured: true,
        authenticated,
        username,
      },
      token: session.token,
      expiresAt: session.record.expiresAt,
    };
  };

  private createSession = (username: string): { token: string; record: AccessSessionRecord } => {
    const token = createAccessSessionToken();
    const now = this.now();
    const expiresAt = new Date(now.getTime() + this.sessionTtlMs).toISOString();
    const record: AccessSessionRecord = {
      tokenHash: hashAccessSessionToken(token),
      principal: {
        id: username,
        role: "admin",
      },
      createdAt: now.toISOString(),
      expiresAt,
    };
    this.sessions.saveSession(record, now);
    return { token, record };
  };
}
