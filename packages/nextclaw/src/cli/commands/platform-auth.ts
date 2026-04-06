import { getConfigPath, loadConfig, saveConfig } from "@nextclaw/core";
import { createInterface } from "node:readline";
import { buildPlatformApiBaseErrorMessage, resolvePlatformApiBase } from "./remote-support/platform-api-base.js";
import type { LoginCommandOptions } from "../types.js";
import { prompt } from "../utils.js";

type NextclawProviderConfig = {
  displayName?: string;
  apiKey?: string;
  apiBase?: string | null;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses";
  models?: string[];
};

export type PlatformLoginResult = {
  token: string;
  role: string;
  email: string;
  platformBase: string;
  v1Base: string;
};

export type PlatformBrowserAuthStartResult = {
  sessionId: string;
  verificationUri: string;
  expiresAt: string;
  intervalMs: number;
  platformBase: string;
  v1Base: string;
};

export type PlatformBrowserAuthPollResult =
  | {
    status: "pending";
    nextPollMs: number;
  }
  | {
    status: "authorized";
    token: string;
    role: string;
    email: string;
    platformBase: string;
    v1Base: string;
  }
  | {
    status: "expired";
    message: string;
  };

function resolveProviderConfig(opts: LoginCommandOptions): {
  configPath: string;
  config: ReturnType<typeof loadConfig>;
  providers: Record<string, NextclawProviderConfig>;
  nextclawProvider: NextclawProviderConfig;
  platformBase: string;
  v1Base: string;
  inputApiBase: string;
} {
  const configPath = getConfigPath();
  const config = loadConfig(configPath);
  const providers = config.providers as Record<string, NextclawProviderConfig>;
  const nextclawProvider = providers.nextclaw ?? {
    displayName: "",
    apiKey: "",
    apiBase: null,
    extraHeaders: null,
    wireApi: "auto",
    models: []
  };
  const configuredApiBase =
    typeof nextclawProvider.apiBase === "string" && nextclawProvider.apiBase.trim().length > 0
      ? nextclawProvider.apiBase.trim()
      : "https://ai-gateway-api.nextclaw.io/v1";
  const requestedApiBase =
    typeof opts.apiBase === "string" && opts.apiBase.trim().length > 0
      ? opts.apiBase.trim()
      : configuredApiBase;
  const { platformBase, v1Base, inputApiBase } = resolvePlatformApiBase({
    explicitApiBase: requestedApiBase,
    fallbackApiBase: "https://ai-gateway-api.nextclaw.io/v1"
  });
  return {
    configPath,
    config,
    providers,
    nextclawProvider,
    platformBase,
    v1Base,
    inputApiBase
  };
}

async function resolveCredentials(opts: LoginCommandOptions): Promise<{ email: string; password: string }> {
  let email = typeof opts.email === "string" ? opts.email.trim() : "";
  let password = typeof opts.password === "string" ? opts.password : "";
  if (email && password) {
    return { email, password };
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });
  try {
    if (!email) {
      email = (await prompt(rl, "Email: ")).trim();
    }
    if (!password) {
      password = await prompt(rl, "Password: ");
    }
  } finally {
    rl.close();
  }

  if (!email || !password) {
    throw new Error("Email and password are required.");
  }
  return { email, password };
}

function readLoginPayload(raw: string): { token: string; role: string } {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }
  const token =
    typeof parsed === "object" &&
    parsed &&
    "data" in parsed &&
    typeof (parsed as { data?: { token?: unknown } }).data?.token === "string"
      ? (parsed as { data: { token: string } }).data.token
      : "";
  const role =
    typeof parsed === "object" &&
    parsed &&
    "data" in parsed &&
    typeof (parsed as { data?: { user?: { role?: unknown } } }).data?.user?.role === "string"
      ? (parsed as { data: { user: { role: string } } }).data.user.role
      : "user";
  if (!token) {
    throw new Error("Login succeeded but token is missing.");
  }
  return { token, role };
}

function persistPlatformToken(params: {
  configPath: string;
  config: ReturnType<typeof loadConfig>;
  providers: Record<string, NextclawProviderConfig>;
  nextclawProvider: NextclawProviderConfig;
  v1Base: string;
  token: string;
}): void {
  params.nextclawProvider.apiBase = params.v1Base;
  params.nextclawProvider.apiKey = params.token;
  params.providers.nextclaw = params.nextclawProvider;
  saveConfig(params.config, params.configPath);
}

function parseJsonText(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function readPlatformErrorMessage(raw: string, fallbackStatus: number): string {
  const parsed = parseJsonText(raw);
  return typeof parsed === "object" &&
    parsed &&
    "error" in parsed &&
    typeof (parsed as { error?: { message?: unknown } }).error?.message === "string"
    ? (parsed as { error: { message: string } }).error.message
    : raw || `Request failed (${fallbackStatus})`;
}

function readBrowserAuthStartPayload(raw: string): {
  sessionId: string;
  verificationUri: string;
  expiresAt: string;
  intervalMs: number;
} {
  const parsed = parseJsonText(raw);
  const data = typeof parsed === "object" && parsed && "data" in parsed
    ? (parsed as { data?: Record<string, unknown> }).data
    : null;
  const sessionId = typeof data?.sessionId === "string" ? data.sessionId.trim() : "";
  const verificationUri = typeof data?.verificationUri === "string" ? data.verificationUri.trim() : "";
  const expiresAt = typeof data?.expiresAt === "string" ? data.expiresAt.trim() : "";
  const intervalMs = typeof data?.intervalMs === "number" && Number.isFinite(data.intervalMs)
    ? Math.max(1000, Math.trunc(data.intervalMs))
    : 1500;
  if (!sessionId || !verificationUri || !expiresAt) {
    throw new Error("Browser authorization session payload is incomplete.");
  }
  return {
    sessionId,
    verificationUri,
    expiresAt,
    intervalMs
  };
}

function readBrowserAuthPollPayload(raw: string): {
  status: "pending" | "authorized" | "expired";
  nextPollMs?: number;
  token?: string;
  role?: string;
  email?: string;
  message?: string;
} {
  const parsed = parseJsonText(raw);
  const data = typeof parsed === "object" && parsed && "data" in parsed
    ? (parsed as { data?: Record<string, unknown> }).data
    : null;
  const status = typeof data?.status === "string" ? data.status.trim() : "";
  if (status === "pending") {
    return {
      status,
      nextPollMs: typeof data?.nextPollMs === "number" && Number.isFinite(data.nextPollMs)
        ? Math.max(1000, Math.trunc(data.nextPollMs))
        : 1500
    };
  }
  if (status === "expired") {
    return {
      status,
      message: typeof data?.message === "string" && data.message.trim()
        ? data.message.trim()
        : "Authorization session expired."
    };
  }
  if (status !== "authorized") {
    throw new Error("Unexpected browser authorization status.");
  }
  const token = typeof data?.token === "string" ? data.token.trim() : "";
  const user = typeof data?.user === "object" && data.user ? data.user as Record<string, unknown> : null;
  const role = typeof user?.role === "string" ? user.role.trim() : "user";
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  if (!token || !email) {
    throw new Error("Authorized browser login payload is incomplete.");
  }
  return {
    status,
    token,
    role,
    email
  };
}

export class PlatformAuthCommands {
  async loginResult(opts: LoginCommandOptions = {}): Promise<PlatformLoginResult> {
    const { configPath, config, providers, nextclawProvider, platformBase, v1Base, inputApiBase } = resolveProviderConfig(opts);
    const { email, password } = await resolveCredentials(opts);
    const response = await fetch(`${platformBase}/platform/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });
    const raw = await response.text();

    if (!response.ok) {
      throw new Error(buildPlatformApiBaseErrorMessage(inputApiBase, readPlatformErrorMessage(raw, response.status)));
    }

    const { token, role } = readLoginPayload(raw);
    persistPlatformToken({
      configPath,
      config,
      providers,
      nextclawProvider,
      v1Base,
      token
    });

    return {
      token,
      role,
      email,
      platformBase,
      v1Base
    };
  }

  async startBrowserAuth(opts: Pick<LoginCommandOptions, "apiBase"> = {}): Promise<PlatformBrowserAuthStartResult> {
    const { platformBase, v1Base, inputApiBase } = resolveProviderConfig(opts);
    const response = await fetch(`${platformBase}/platform/auth/browser/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(buildPlatformApiBaseErrorMessage(inputApiBase, readPlatformErrorMessage(raw, response.status)));
    }
    const result = readBrowserAuthStartPayload(raw);
    return {
      ...result,
      platformBase,
      v1Base
    };
  }

  async pollBrowserAuth(params: {
    apiBase?: string;
    sessionId: string;
  }): Promise<PlatformBrowserAuthPollResult> {
    const { configPath, config, providers, nextclawProvider, platformBase, v1Base, inputApiBase } = resolveProviderConfig({
      apiBase: params.apiBase
    });
    const response = await fetch(`${platformBase}/platform/auth/browser/poll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sessionId: params.sessionId
      })
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(buildPlatformApiBaseErrorMessage(inputApiBase, readPlatformErrorMessage(raw, response.status)));
    }
    const result = readBrowserAuthPollPayload(raw);
    if (result.status === "pending") {
      return {
        status: "pending",
        nextPollMs: result.nextPollMs ?? 1500
      };
    }
    if (result.status === "expired") {
      return {
        status: "expired",
        message: result.message ?? "Authorization session expired."
      };
    }

    persistPlatformToken({
      configPath,
      config,
      providers,
      nextclawProvider,
      v1Base,
      token: result.token ?? ""
    });
    return {
      status: "authorized",
      token: result.token ?? "",
      role: result.role ?? "user",
      email: result.email ?? "",
      platformBase,
      v1Base
    };
  }

  async login(opts: LoginCommandOptions = {}): Promise<void> {
    const result = await this.loginResult(opts);

    console.log(`✓ Logged in to NextClaw platform (${result.platformBase})`);
    console.log(`✓ Account: ${result.email} (${result.role})`);
    console.log(`✓ Token saved into providers.nextclaw.apiKey`);
  }

  logout(): { cleared: boolean } {
    const { configPath, config, providers, nextclawProvider } = resolveProviderConfig({});
    const cleared = Boolean(nextclawProvider.apiKey?.trim());
    nextclawProvider.apiKey = "";
    providers.nextclaw = nextclawProvider;
    saveConfig(config, configPath);
    return { cleared };
  }
}
