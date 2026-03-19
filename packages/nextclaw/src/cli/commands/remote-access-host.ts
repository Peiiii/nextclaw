import { getConfigPath, loadConfig } from "@nextclaw/core";
import type {
  RemoteAccessView,
  RemoteAccountView,
  RemoteDoctorView,
  RemoteRuntimeView,
  RemoteServiceAction,
  RemoteServiceActionResult,
  RemoteServiceView,
  RemoteSettingsUpdateRequest,
  UiRemoteAccessHost
} from "@nextclaw/server";
import { spawn } from "node:child_process";
import type { PlatformAuthCommands } from "./platform-auth.js";
import type { RemoteCommands } from "./remote.js";
import { isProcessRunning, readServiceState, resolveServiceStatePath, resolveUiConfig } from "../utils.js";

type RemoteAccessHostServiceCommands = {
  startService: (options: { uiOverrides: Partial<ReturnType<typeof resolveUiConfig>>; open: boolean }) => Promise<void>;
  stopService: () => Promise<void>;
};

const FORCED_PUBLIC_UI_HOST = "0.0.0.0";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const segments = token.split(".");
  if (segments.length < 2) {
    return null;
  }
  try {
    const raw = Buffer.from(segments[1]!, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
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
    }
  ) {}

  getStatus(): RemoteAccessView {
    const config = loadConfig(getConfigPath());
    const status = this.deps.remoteCommands.getStatusView();
    const serviceState = readServiceState();
    const serviceRunning = Boolean(serviceState && isProcessRunning(serviceState.pid));
    const account = this.readAccountView({
      token: normalizeOptionalString(config.providers.nextclaw?.apiKey),
      apiBase: normalizeOptionalString(config.providers.nextclaw?.apiBase),
      platformBase: status.platformBase
    });
    const service: RemoteServiceView = {
      running: serviceRunning,
      currentProcess: Boolean(serviceRunning && serviceState?.pid === process.pid),
      ...(serviceState?.pid ? { pid: serviceState.pid } : {}),
      ...(serviceState?.uiUrl ? { uiUrl: serviceState.uiUrl } : {}),
      ...(typeof serviceState?.uiPort === "number" ? { uiPort: serviceState.uiPort } : {})
    };
    return {
      account,
      settings: {
        enabled: config.remote.enabled,
        deviceName: config.remote.deviceName,
        platformApiBase: config.remote.platformApiBase
      },
      service,
      localOrigin: status.localOrigin,
      configuredEnabled: status.configuredEnabled,
      platformBase: status.platformBase,
      runtime: toRemoteRuntimeView(status.runtime)
    };
  }

  async login(input: {
    email: string;
    password: string;
    apiBase?: string;
    register?: boolean;
  }): Promise<RemoteAccessView> {
    await this.deps.platformAuthCommands.loginResult(input);
    return this.getStatus();
  }

  logout(): RemoteAccessView {
    this.deps.platformAuthCommands.logout();
    return this.getStatus();
  }

  updateSettings(input: RemoteSettingsUpdateRequest): RemoteAccessView {
    this.deps.remoteCommands.updateConfig({
      enabled: input.enabled,
      apiBase: input.platformApiBase,
      name: input.deviceName
    });
    return this.getStatus();
  }

  async runDoctor(): Promise<RemoteDoctorView> {
    const report = await this.deps.remoteCommands.getDoctorView();
    return {
      generatedAt: report.generatedAt,
      checks: report.checks,
      snapshot: {
        configuredEnabled: report.snapshot.configuredEnabled,
        runtime: toRemoteRuntimeView(report.snapshot.runtime)
      }
    };
  }

  async controlService(action: RemoteServiceAction): Promise<RemoteServiceActionResult> {
    const state = readServiceState();
    const running = Boolean(state && isProcessRunning(state.pid));
    const currentProcess = Boolean(running && state?.pid === process.pid);
    const uiOverrides = this.resolveManagedUiOverrides();

    if (action === "start") {
      if (running) {
        return {
          accepted: true,
          action,
          message: currentProcess
            ? "Managed service is already running for this UI."
            : "Managed service is already running."
        };
      }
      await this.deps.serviceCommands.startService({
        uiOverrides,
        open: false
      });
      return {
        accepted: true,
        action,
        message: "Managed service started."
      };
    }

    if (!running) {
      if (action === "restart") {
        await this.deps.serviceCommands.startService({
          uiOverrides,
          open: false
        });
        return {
          accepted: true,
          action,
          message: "Managed service was not running and has been started."
        };
      }
      return {
        accepted: true,
        action,
        message: "No managed service is currently running."
      };
    }

    if (currentProcess) {
      if (action === "restart") {
        await this.deps.requestManagedServiceRestart({
          uiPort: uiOverrides.port ?? 18791
        });
      } else {
        this.scheduleSelfStop();
      }
      return {
        accepted: true,
        action,
        message:
          action === "restart"
            ? "Restart scheduled. This page may disconnect for a few seconds."
            : "Stop scheduled. This page will disconnect shortly."
      };
    }

    if (action === "stop") {
      await this.deps.serviceCommands.stopService();
      return {
        accepted: true,
        action,
        message: "Managed service stopped."
      };
    }

    await this.deps.serviceCommands.stopService();
    await this.deps.serviceCommands.startService({
      uiOverrides,
      open: false
    });
    return {
      accepted: true,
      action,
      message: "Managed service restarted."
    };
  }

  private resolveManagedUiOverrides(): Partial<ReturnType<typeof resolveUiConfig>> {
    const config = loadConfig(getConfigPath());
    const resolved = resolveUiConfig(config, {
      enabled: true,
      host: FORCED_PUBLIC_UI_HOST,
      open: false
    });
    return {
      enabled: true,
      host: FORCED_PUBLIC_UI_HOST,
      open: false,
      port: resolved.port
    };
  }

  private readAccountView(params: {
    token: string | null;
    apiBase: string | null;
    platformBase: string | null;
  }): RemoteAccountView {
    if (!params.token) {
      return {
        loggedIn: false,
        apiBase: params.apiBase,
        platformBase: params.platformBase
      };
    }
    const payload = decodeJwtPayload(params.token);
    const email = typeof payload?.email === "string" ? payload.email : undefined;
    const role = typeof payload?.role === "string" ? payload.role : undefined;
    return {
      loggedIn: true,
      email,
      role,
      apiBase: params.apiBase,
      platformBase: params.platformBase
    };
  }

  private scheduleSelfStop(): void {
    this.launchManagedSelfControl();
  }

  private launchManagedSelfControl(params: {
    command?: string;
    args?: string[];
  } = {}): void {
    const script = [
      'const { spawn } = require("node:child_process");',
      'const { rmSync } = require("node:fs");',
      `const parentPid = ${process.pid};`,
      `const serviceStatePath = ${JSON.stringify(resolveServiceStatePath())};`,
      `const command = ${JSON.stringify(params.command ?? null)};`,
      `const args = ${JSON.stringify(params.args ?? [])};`,
      `const cwd = ${JSON.stringify(process.cwd())};`,
      "const env = process.env;",
      "function isRunning(pid) {",
      "  try {",
      "    process.kill(pid, 0);",
      "    return true;",
      "  } catch {",
      "    return false;",
      "  }",
      "}",
      "setTimeout(() => {",
      "  try {",
      "    process.kill(parentPid, 'SIGTERM');",
      "  } catch {}",
      "}, 150);",
      "const startedAt = Date.now();",
      "const maxWaitMs = 30000;",
      "const timer = setInterval(() => {",
      "  if (isRunning(parentPid)) {",
      "    if (Date.now() - startedAt > maxWaitMs) {",
      "      try {",
      "        process.kill(parentPid, 'SIGKILL');",
      "      } catch {}",
      "    }",
      "    return;",
      "  }",
      "  clearInterval(timer);",
      "  try {",
      "    rmSync(serviceStatePath, { force: true });",
      "  } catch {}",
      "  if (command) {",
      "    const child = spawn(command, args, { detached: true, stdio: 'ignore', cwd, env });",
      "    child.unref();",
      "  }",
      "  process.exit(0);",
      "}, 250);"
    ].join("");
    const helper = spawn(process.execPath, ["-e", script], {
      detached: true,
      stdio: "ignore",
      env: process.env,
      cwd: process.cwd()
    });
    helper.unref();
  }
}
