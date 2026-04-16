import { getConfigPath, loadConfig, saveConfig } from "@nextclaw/core";
import { createInterface } from "node:readline";
import { buildPlatformApiBaseErrorMessage, resolvePlatformApiBase } from "./remote-support/platform-api-base.js";
import {
  readBrowserAuthPollPayload,
  readBrowserAuthStartPayload,
  readLoginPayload,
  readPlatformAuthResultPayload,
  readPlatformErrorMessage,
  readPlatformUserPayload
} from "./platform-auth-support/payload.js";
import type { LoginCommandOptions } from "../types.js";
import { openBrowser, prompt } from "../utils.js";

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

export type PlatformUserView = {
  id: string;
  email: string;
  username: string | null;
  role: string;
};

export type PlatformMeResult = {
  user: PlatformUserView;
  token: string;
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

function persistPlatformToken(params: {
  configPath: string;
  config: ReturnType<typeof loadConfig>;
  providers: Record<string, NextclawProviderConfig>;
  nextclawProvider: NextclawProviderConfig;
  v1Base: string;
  token: string;
}): void {
  const { configPath, config, providers, nextclawProvider, v1Base, token } = params;
  nextclawProvider.apiBase = v1Base;
  nextclawProvider.apiKey = token;
  providers.nextclaw = nextclawProvider;
  saveConfig(config, configPath);
}

export class PlatformAuthCommands {
  private shouldUseBrowserLogin = (opts: LoginCommandOptions): boolean => {
    const email = typeof opts.email === "string" ? opts.email.trim() : "";
    const password = typeof opts.password === "string" ? opts.password : "";
    return !email && !password;
  };

  private waitFor = async (delayMs: number): Promise<void> => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  };

  private formatLoginDeadline = (expiresAt: string): string => {
    const value = Date.parse(expiresAt);
    return Number.isNaN(value) ? expiresAt : new Date(value).toLocaleString();
  };

  private printLoginSuccess = (result: PlatformLoginResult): void => {
    console.log(`✓ Logged in to NextClaw platform (${result.platformBase})`);
    console.log(`✓ Account: ${result.email} (${result.role})`);
    console.log("✓ Token saved into providers.nextclaw.apiKey");
  };

  private printBrowserLoginIntro = (params: {
    verificationUri: string;
    expiresAt: string;
    open: boolean;
    openedBrowser: boolean;
  }): void => {
    const {
      expiresAt,
      open,
      openedBrowser,
      verificationUri
    } = params;
    const expiresText = this.formatLoginDeadline(expiresAt);
    console.log("NextClaw browser sign-in");
    console.log(`Open this link to continue: ${verificationUri}`);
    if (open) {
      if (openedBrowser) {
        console.log("✓ Opened the default browser. Finish sign-in there and this terminal will complete automatically.");
      } else {
        console.log("Browser did not open automatically. Open the link above in any browser to continue.");
      }
    } else {
      console.log("Automatic browser opening is disabled. Open the link above in any browser to continue.");
    }
    console.log("This link can be opened on this machine or on another device if your CLI is running remotely.");
    console.log(`Waiting for authorization until ${expiresText}...`);
  };

  private waitForBrowserLoginResult = async (params: {
    apiBase?: string;
    sessionId: string;
  }): Promise<PlatformLoginResult> => {
    while (true) {
      const result = await this.pollBrowserAuth({
        apiBase: params.apiBase,
        sessionId: params.sessionId
      });
      if (result.status === "pending") {
        await this.waitFor(result.nextPollMs);
        continue;
      }
      if (result.status === "expired") {
        throw new Error(`${result.message} Run \`nextclaw login\` again to generate a new sign-in link.`);
      }
      return {
        token: result.token,
        role: result.role,
        email: result.email,
        platformBase: result.platformBase,
        v1Base: result.v1Base
      };
    }
  };

  private loginWithBrowserResult = async (opts: LoginCommandOptions = {}): Promise<PlatformLoginResult> => {
    const startResult = await this.startBrowserAuth({
      apiBase: opts.apiBase
    });
    const shouldOpenBrowser = opts.open !== false;
    const openedBrowser = shouldOpenBrowser ? openBrowser(startResult.verificationUri) : false;
    this.printBrowserLoginIntro({
      verificationUri: startResult.verificationUri,
      expiresAt: startResult.expiresAt,
      open: shouldOpenBrowser,
      openedBrowser
    });
    const result = await this.waitForBrowserLoginResult({
      apiBase: opts.apiBase,
      sessionId: startResult.sessionId
    });
    console.log("✓ Browser authorization completed.");
    return result;
  };

  private readStoredToken = (params: { apiBase?: string } = {}): {
    configPath: string;
    config: ReturnType<typeof loadConfig>;
    providers: Record<string, NextclawProviderConfig>;
    nextclawProvider: NextclawProviderConfig;
    platformBase: string;
    v1Base: string;
    inputApiBase: string;
    token: string;
  } => {
    const resolved = resolveProviderConfig({ apiBase: params.apiBase });
    const token = resolved.nextclawProvider.apiKey?.trim() ?? "";
    if (!token) {
      throw new Error("Not logged in. Run `nextclaw login` first.");
    }
    return {
      ...resolved,
      token
    };
  };

  loginResult = async (opts: LoginCommandOptions = {}): Promise<PlatformLoginResult> => {
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
  };

  startBrowserAuth = async (opts: Pick<LoginCommandOptions, "apiBase"> = {}): Promise<PlatformBrowserAuthStartResult> => {
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
  };

  pollBrowserAuth = async (params: {
    apiBase?: string;
    sessionId: string;
  }): Promise<PlatformBrowserAuthPollResult> => {
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
  };

  login = async (opts: LoginCommandOptions = {}): Promise<void> => {
    const result = this.shouldUseBrowserLogin(opts)
      ? await this.loginWithBrowserResult(opts)
      : await this.loginResult(opts);
    this.printLoginSuccess(result);
  };

  me = async (params: { apiBase?: string } = {}): Promise<PlatformMeResult> => {
    const { platformBase, v1Base, inputApiBase, token } = this.readStoredToken(params);
    const response = await fetch(`${platformBase}/platform/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(buildPlatformApiBaseErrorMessage(inputApiBase, readPlatformErrorMessage(raw, response.status)));
    }
    return {
      user: readPlatformUserPayload(raw),
      token,
      platformBase,
      v1Base
    };
  };

  updateProfile = async (params: { username: string; apiBase?: string }): Promise<PlatformMeResult> => {
    const {
      configPath,
      config,
      providers,
      nextclawProvider,
      platformBase,
      v1Base,
      inputApiBase,
      token
    } = this.readStoredToken(params);
    const response = await fetch(`${platformBase}/platform/auth/profile`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: params.username
      })
    });
    const raw = await response.text();
    if (!response.ok) {
      throw new Error(buildPlatformApiBaseErrorMessage(inputApiBase, readPlatformErrorMessage(raw, response.status)));
    }
    const result = readPlatformAuthResultPayload(raw);
    persistPlatformToken({
      configPath,
      config,
      providers,
      nextclawProvider,
      v1Base,
      token: result.token
    });
    return {
      user: result.user,
      token: result.token,
      platformBase,
      v1Base
    };
  };

  logout = (): { cleared: boolean } => {
    const { configPath, config, providers, nextclawProvider } = resolveProviderConfig({});
    const cleared = Boolean(nextclawProvider.apiKey?.trim());
    nextclawProvider.apiKey = "";
    providers.nextclaw = nextclawProvider;
    saveConfig(config, configPath);
    return { cleared };
  };
}
