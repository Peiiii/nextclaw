import { getConfigPath, loadConfig } from "@nextclaw/core";
import { readPlatformSessionTokenState } from "@nextclaw/remote";
import type {
  RemoteAccessView,
  RemoteAccountView,
  RemoteBrowserAuthPollRequest,
  RemoteBrowserAuthPollResult,
  RemoteBrowserAuthStartRequest,
  RemoteBrowserAuthStartResult,
  RemoteDoctorView,
  RemoteRuntimeView,
  RemoteServiceAction,
  RemoteServiceActionResult,
  RemoteSettingsUpdateRequest,
  UiRemoteAccessHost
} from "@nextclaw/server";
import type { PlatformAuthCommands } from "../platform-auth/index.js";
import type { RemoteCommands } from "../remote/index.js";
import {
  controlRemoteService,
  resolveRemoteServiceView,
  type RemoteAccessHostServiceCommands,
  type RemoteRuntimeController
} from "./remote-access-service-control.js";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toRemoteRuntimeView(runtime: ReturnType<RemoteCommands["getStatusView"]>["runtime"]): RemoteRuntimeView | null {
  if (!runtime) {
    return null;
  }
  return {
    enabled: runtime.enabled,
    mode: runtime.mode,
    state: runtime.state,
    deviceId: runtime.deviceId,
    deviceName: runtime.deviceName,
    platformBase: runtime.platformBase,
    localOrigin: runtime.localOrigin,
    lastConnectedAt: runtime.lastConnectedAt,
    lastError: runtime.lastError,
    updatedAt: runtime.updatedAt
  };
}

export class RemoteAccessHost implements UiRemoteAccessHost {
  constructor(
    private readonly deps: {
      serviceCommands: RemoteAccessHostServiceCommands;
      requestManagedServiceRestart: (options?: { uiPort?: number; reason?: string }) => Promise<void>;
      remoteCommands: RemoteCommands;
      platformAuthCommands: PlatformAuthCommands;
      currentUi?: {
        host: string;
        port: number;
      };
      remoteRuntimeController?: RemoteRuntimeController | null;
    }
  ) {}

  getStatus = (): RemoteAccessView => {
    const config = loadConfig(getConfigPath());
    const status = this.deps.remoteCommands.getStatusView();
    const account = this.readAccountView({
      token: normalizeOptionalString(config.providers.nextclaw?.apiKey),
      apiBase: normalizeOptionalString(config.providers.nextclaw?.apiBase),
      platformBase: status.platformBase
    });
    return {
      account,
      settings: {
        enabled: config.remote.enabled,
        deviceName: config.remote.deviceName,
        platformApiBase: config.remote.platformApiBase
      },
      service: resolveRemoteServiceView(this.deps.currentUi),
      localOrigin: status.localOrigin,
      configuredEnabled: status.configuredEnabled,
      platformBase: status.platformBase,
      runtime: toRemoteRuntimeView(status.runtime)
    };
  };

  login = async (input: {
    email: string;
    password: string;
    apiBase?: string;
  }): Promise<RemoteAccessView> => {
    await this.deps.platformAuthCommands.loginResult(input);
    return this.getStatus();
  };

  startBrowserAuth = async (input: RemoteBrowserAuthStartRequest): Promise<RemoteBrowserAuthStartResult> => {
    const result = await this.deps.platformAuthCommands.startBrowserAuth({
      apiBase: input.apiBase
    });
    return {
      sessionId: result.sessionId,
      verificationUri: result.verificationUri,
      expiresAt: result.expiresAt,
      intervalMs: result.intervalMs
    };
  };

  pollBrowserAuth = async (input: RemoteBrowserAuthPollRequest): Promise<RemoteBrowserAuthPollResult> => {
    const config = loadConfig(getConfigPath());
    const result = await this.deps.platformAuthCommands.pollBrowserAuth({
      apiBase: normalizeOptionalString(input.apiBase)
        ?? normalizeOptionalString(config.remote.platformApiBase)
        ?? normalizeOptionalString(config.providers.nextclaw?.apiBase)
        ?? undefined,
      sessionId: input.sessionId
    });
    if (result.status !== "authorized") {
      return result;
    }
    return {
      status: "authorized",
      email: result.email,
      role: result.role
    };
  };

  logout = (): RemoteAccessView => {
    this.deps.platformAuthCommands.logout();
    return this.getStatus();
  };

  updateSettings = (input: RemoteSettingsUpdateRequest): RemoteAccessView => {
    this.deps.remoteCommands.updateConfig({
      enabled: input.enabled,
      apiBase: input.platformApiBase,
      name: input.deviceName
    });
    return this.getStatus();
  };

  runDoctor = async (): Promise<RemoteDoctorView> => {
    const report = await this.deps.remoteCommands.getDoctorView();
    return {
      generatedAt: report.generatedAt,
      checks: report.checks,
      snapshot: {
        configuredEnabled: report.snapshot.configuredEnabled,
        runtime: toRemoteRuntimeView(report.snapshot.runtime)
      }
    };
  };

  controlService = async (action: RemoteServiceAction): Promise<RemoteServiceActionResult> => {
    return controlRemoteService(action, this.deps);
  };

  private readAccountView = (params: {
    token: string | null;
    apiBase: string | null;
    platformBase: string | null;
  }): RemoteAccountView => {
    const { apiBase, platformBase, token } = params;
    const tokenState = readPlatformSessionTokenState(token);
    if (!tokenState.valid) {
      return {
        loggedIn: false,
        apiBase,
        platformBase
      };
    }
    const payload = tokenState.payload;
    const email = typeof payload?.email === "string" ? payload.email : undefined;
    const username = typeof payload?.username === "string" ? payload.username : undefined;
    const role = typeof payload?.role === "string" ? payload.role : undefined;
    return {
      loggedIn: true,
      email,
      username,
      role,
      apiBase,
      platformBase
    };
  };

  updateProfile = async (input: { username: string }): Promise<RemoteAccessView> => {
    await this.deps.platformAuthCommands.updateProfile({
      username: input.username
    });
    return this.getStatus();
  };
}
