import { getConfigPath, loadConfig, saveConfig } from "@nextclaw/core";
import { createInterface } from "node:readline";
import { buildPlatformApiBaseErrorMessage, resolvePlatformApiBase } from "./platform-api-base.js";
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

export class PlatformAuthCommands {
  async loginResult(opts: LoginCommandOptions = {}): Promise<PlatformLoginResult> {
    const { configPath, config, providers, nextclawProvider, platformBase, v1Base, inputApiBase } = resolveProviderConfig(opts);
    const { email, password } = await resolveCredentials(opts);
    const endpoint = opts.register
      ? `${platformBase}/platform/auth/register`
      : `${platformBase}/platform/auth/login`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });
    const raw = await response.text();

    if (!response.ok) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
      const maybeMessage =
        typeof parsed === "object" &&
        parsed &&
        "error" in parsed &&
        typeof (parsed as { error?: { message?: unknown } }).error?.message === "string"
          ? (parsed as { error: { message: string } }).error.message
          : raw || `Request failed (${response.status})`;
      throw new Error(buildPlatformApiBaseErrorMessage(inputApiBase, maybeMessage));
    }

    const { token, role } = readLoginPayload(raw);
    nextclawProvider.apiBase = v1Base;
    nextclawProvider.apiKey = token;
    providers.nextclaw = nextclawProvider;
    saveConfig(config, configPath);

    return {
      token,
      role,
      email,
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
