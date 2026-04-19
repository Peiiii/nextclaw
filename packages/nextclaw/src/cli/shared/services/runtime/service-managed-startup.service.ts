import * as NextclawCore from "@nextclaw/core";
import { FileLogSink } from "@nextclaw/core";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { localUiRuntimeStore } from "@/cli/shared/stores/local-ui-runtime.store.js";
import { managedServiceStateStore, type ManagedServiceState } from "@/cli/shared/stores/managed-service-state.store.js";
import { resolveCliSubcommandLaunch } from "@/cli/shared/utils/marketplace/cli-subcommand-launch.utils.js";
import { writeInitialManagedServiceState, writeReadyManagedServiceState } from "@/cli/shared/services/runtime/service-remote-runtime.service.js";
import {
  isProcessRunning,
  openBrowser,
  resolveServiceLogPath,
  resolveUiApiBase,
  resolveUiConfig,
  resolveUiStaticDir,
  waitForExit
} from "@/cli/shared/utils/cli.utils.js";
import { probeHealthEndpoint } from "@/cli/shared/utils/service-port-probe.utils.js";

const { APP_NAME, loadConfig } = NextclawCore;

type Config = NextclawCore.Config;

export type StartServiceOptions = {
  uiOverrides: Partial<Config["ui"]>;
  open: boolean;
  startupTimeoutMs?: number;
};

export type ManagedServiceSnapshot = {
  pid: number;
  uiUrl: string;
  apiUrl: string;
  uiHost: string;
  uiPort: number;
  logPath: string;
};

function toObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function hasSessionRoutingMetadata(params: {
  metadata: Record<string, unknown>;
  normalizeOptionalString: (value: unknown) => string | undefined;
}): boolean {
  const context = toObjectRecord(params.metadata.last_delivery_context) ?? {};
  const hasPrimaryRoute =
    Boolean(params.normalizeOptionalString(context.channel)) &&
    Boolean(params.normalizeOptionalString(context.chatId));
  const hasFallbackRoute =
    Boolean(params.normalizeOptionalString(params.metadata.last_channel)) &&
    Boolean(params.normalizeOptionalString(params.metadata.last_to));
  return hasPrimaryRoute || hasFallbackRoute;
}

export function resolveManagedServiceUiBinding(state: ManagedServiceState): {
  host: string;
  port: number;
} {
  try {
    const parsed = new URL(state.uiUrl);
    const parsedPort = Number(parsed.port || 80);
    return {
      host: state.uiHost ?? parsed.hostname,
      port: Number.isFinite(parsedPort) ? parsedPort : state.uiPort ?? 55667
    };
  } catch {
    return {
      host: state.uiHost ?? "127.0.0.1",
      port: state.uiPort ?? 55667
    };
  }
}

export function resolveSessionRouteCandidate(params: {
  session: unknown;
  normalizeOptionalString: (value: unknown) => string | undefined;
}): { key: string; updatedAt: number } | null {
  const sessionRecord = toObjectRecord(params.session);
  const key = params.normalizeOptionalString(sessionRecord?.key);
  if (!key || key.startsWith("cli:")) {
    return null;
  }
  const metadata = toObjectRecord(sessionRecord?.metadata) ?? {};
  if (!hasSessionRoutingMetadata({ metadata, normalizeOptionalString: params.normalizeOptionalString })) {
    return null;
  }
  const updatedAtRaw = params.normalizeOptionalString(sessionRecord?.updated_at);
  const updatedAt = updatedAtRaw ? Date.parse(updatedAtRaw) : Number.NaN;
  return {
    key,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0
  };
}

export function spawnManagedService(params: {
  appName: string;
  config: NextclawCore.Config;
  uiConfig: { host: string; port: number };
  uiUrl: string;
  apiUrl: string;
  healthUrl: string;
  startupTimeoutMs?: number;
  resolveStartupTimeoutMs: (overrideTimeoutMs: number | undefined) => number;
  appendStartupStage: (logPath: string, message: string) => void;
  printStartupFailureDiagnostics: (params: {
    uiUrl: string;
    apiUrl: string;
    healthUrl: string;
    logPath: string;
    lastProbeError: string | null;
  }) => void;
  resolveServiceLogPath: () => string;
}): {
  child: ReturnType<typeof spawn>;
  logPath: string;
  readinessTimeoutMs: number;
  quickPhaseTimeoutMs: number;
  extendedPhaseTimeoutMs: number;
  snapshot: ManagedServiceSnapshot;
} | null {
  const {
    appName,
    config,
    uiConfig,
    uiUrl,
    apiUrl,
    healthUrl,
    startupTimeoutMs,
    resolveStartupTimeoutMs,
    appendStartupStage,
    printStartupFailureDiagnostics,
    resolveServiceLogPath
  } = params;
  const logPath = resolveServiceLogPath();
  new FileLogSink({ serviceLogPath: logPath }).ensureReady();
  const logDir = dirname(logPath);
  mkdirSync(logDir, { recursive: true });
  const readinessTimeoutMs = resolveStartupTimeoutMs(startupTimeoutMs);
  const quickPhaseTimeoutMs = Math.min(8000, readinessTimeoutMs);
  const extendedPhaseTimeoutMs = Math.max(0, readinessTimeoutMs - quickPhaseTimeoutMs);
  appendStartupStage(
    logPath,
    `start requested: ui=${uiConfig.host}:${uiConfig.port}, readinessTimeoutMs=${readinessTimeoutMs}`
  );
  console.log(`Starting ${appName} background service (readiness timeout ${Math.ceil(readinessTimeoutMs / 1000)}s)...`);

  const cliLaunch = resolveCliSubcommandLaunch({
    argvEntry: process.argv[1],
    importMetaUrl: import.meta.url,
    cliArgs: ["serve", "--ui-port", String(uiConfig.port)],
    nodePath: process.execPath
  });
  const childArgs = [...process.execArgv, ...cliLaunch.args];
  appendStartupStage(logPath, `spawning background process: ${cliLaunch.command} ${childArgs.join(" ")}`);
  const child = spawn(cliLaunch.command, childArgs, {
    env: process.env,
    stdio: "ignore",
    detached: true
  });
  appendStartupStage(logPath, `spawned background process pid=${child.pid ?? "unknown"}`);
  if (!child.pid) {
    appendStartupStage(logPath, "spawn failed: child pid missing");
    console.error("Error: Failed to start background service.");
    printStartupFailureDiagnostics({
      uiUrl,
      apiUrl,
      healthUrl,
      logPath,
      lastProbeError: null
    });
    return null;
  }

  const snapshot: ManagedServiceSnapshot = {
    pid: child.pid,
    uiUrl,
    apiUrl,
    uiHost: uiConfig.host,
    uiPort: uiConfig.port,
    logPath
  };
  writeInitialManagedServiceState({
    config,
    readinessTimeoutMs,
    snapshot
  });
  return {
    child,
    logPath,
    readinessTimeoutMs,
    quickPhaseTimeoutMs,
    extendedPhaseTimeoutMs,
    snapshot
  };
}

export async function waitForManagedServiceReadiness(params: {
  appName: string;
  childPid: number;
  healthUrl: string;
  logPath: string;
  readinessTimeoutMs: number;
  quickPhaseTimeoutMs: number;
  extendedPhaseTimeoutMs: number;
  appendStartupStage: (logPath: string, message: string) => void;
  waitForBackgroundServiceReady: (params: {
    pid: number;
    healthUrl: string;
    timeoutMs: number;
  }) => Promise<{ ready: boolean; lastProbeError: string | null }>;
  isProcessRunning: (pid: number) => boolean;
}): Promise<{ ready: boolean; lastProbeError: string | null }> {
  params.appendStartupStage(params.logPath, `health probe started: ${params.healthUrl} (phase=quick, timeoutMs=${params.quickPhaseTimeoutMs})`);
  let readiness = await params.waitForBackgroundServiceReady({
    pid: params.childPid,
    healthUrl: params.healthUrl,
    timeoutMs: params.quickPhaseTimeoutMs
  });
  if (!readiness.ready && params.isProcessRunning(params.childPid) && params.extendedPhaseTimeoutMs > 0) {
    console.warn(
      `Warning: Background service is still running but not ready after ${Math.ceil(params.quickPhaseTimeoutMs / 1000)}s; waiting up to ${Math.ceil(params.extendedPhaseTimeoutMs / 1000)}s more.`
    );
    params.appendStartupStage(
      params.logPath,
      `health probe entering extended phase (timeoutMs=${params.extendedPhaseTimeoutMs}, lastError=${readiness.lastProbeError ?? "none"})`
    );
    readiness = await params.waitForBackgroundServiceReady({
      pid: params.childPid,
      healthUrl: params.healthUrl,
      timeoutMs: params.extendedPhaseTimeoutMs
    });
  }
  if (!readiness.ready && params.isProcessRunning(params.childPid)) {
    params.appendStartupStage(
      params.logPath,
      `startup degraded: process alive but health probe timed out after ${params.readinessTimeoutMs}ms (lastError=${readiness.lastProbeError ?? "none"})`
    );
  }
  return readiness;
}

export async function reportManagedServiceStart(params: {
  appName: string;
  state: { pid: number; logPath: string };
  uiConfig: { host: string; port: number };
  uiUrl: string;
  apiUrl: string;
  readinessTimeoutMs: number;
  readiness: { ready: boolean; lastProbeError: string | null };
  printPublicUiUrls: (host: string, port: number) => Promise<void>;
  printServiceControlHints: () => void;
}): Promise<void> {
  if (!params.readiness.ready) {
    const hint = params.readiness.lastProbeError ? ` Last probe error: ${params.readiness.lastProbeError}` : "";
    console.warn(
      `Warning: ${params.appName} is running (PID ${params.state.pid}) but not healthy yet after ${Math.ceil(params.readinessTimeoutMs / 1000)}s. Marked as degraded.${hint}`
    );
    console.warn(`Tip: Run "${params.appName} status --json" and check logs: ${params.state.logPath}`);
  } else {
    console.log(`✓ ${params.appName} started in background (PID ${params.state.pid})`);
  }
  console.log(`UI: ${params.uiUrl}`);
  console.log(`API: ${params.apiUrl}`);
  await params.printPublicUiUrls(params.uiConfig.host, params.uiConfig.port);
  console.log(`Logs: ${params.state.logPath}`);
  params.printServiceControlHints();
}

export class ManagedServiceCommandService {
  private readonly loggingRuntime = NextclawCore.getLoggingRuntime();
  private readonly serviceLogger = this.loggingRuntime.getLogger("service");

  constructor(private readonly deps: {
    startGateway: (options: { uiOverrides: Partial<Config["ui"]>; allowMissingProvider?: boolean; uiStaticDir?: string | null }) => Promise<void>;
    printPublicUiUrls: (host: string, port: number) => Promise<void>;
    printServiceControlHints: () => void;
    checkUiPortPreflight: (params: { host: string; port: number; healthUrl: string }) => Promise<{ ok: true; reusedExistingHealthyTarget: boolean } | { ok: false; message: string }>;
  }) {}

  runForeground = async (options: {
    uiOverrides: Partial<Config["ui"]>;
    open: boolean;
  }): Promise<void> => {
    const config = loadConfig();
    const uiConfig = resolveUiConfig(config, options.uiOverrides);
    const uiUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);

    if (options.open) {
      openBrowser(uiUrl);
    }

    await this.deps.startGateway({
      uiOverrides: options.uiOverrides,
      allowMissingProvider: true,
      uiStaticDir: resolveUiStaticDir()
    });
  };

  startService = async (options: StartServiceOptions): Promise<void> => {
    this.loggingRuntime.ensureReady();
    const { open, startupTimeoutMs, uiOverrides } = options;
    const config = loadConfig();
    const uiConfig = resolveUiConfig(config, uiOverrides);
    const uiUrl = resolveUiApiBase(uiConfig.host, uiConfig.port);
    const apiUrl = `${uiUrl}/api`;
    const staticDir = resolveUiStaticDir();

    const existing = managedServiceStateStore.read();
    if (existing && isProcessRunning(existing.pid)) {
      await this.handleExistingManagedService({ existing, uiConfig, options });
      return;
    }
    if (existing) {
      managedServiceStateStore.clear();
    }

    if (!staticDir) {
      return void (
        process.exitCode = 1,
        console.error(`Error: ${APP_NAME} UI frontend bundle not found. Reinstall or rebuild ${APP_NAME}. For dev-only overrides, set NEXTCLAW_UI_STATIC_DIR to a built frontend directory.`)
      );
    }

    const healthUrl = `${apiUrl}/health`;
    const portPreflight = await this.deps.checkUiPortPreflight({ host: uiConfig.host, port: uiConfig.port, healthUrl });
    if (!portPreflight.ok) {
      return void (
        process.exitCode = 1,
        console.error(`Error: Cannot start ${APP_NAME} because UI port ${uiConfig.port} is already occupied.`),
        console.error(portPreflight.message)
      );
    }
    if (portPreflight.reusedExistingHealthyTarget) {
      await this.reuseExistingHealthyStartTarget({ uiConfig, uiUrl, apiUrl, open });
      return;
    }

    await this.startNewManagedServiceTarget({
      config,
      uiConfig,
      uiUrl,
      apiUrl,
      healthUrl,
      startupTimeoutMs,
    });

    if (open) {
      openBrowser(uiUrl);
    }
  };

  stopService = async (): Promise<void> => {
    const state = managedServiceStateStore.read();
    if (!state) {
      console.log("No running background service found.");
      return;
    }
    if (!isProcessRunning(state.pid)) {
      console.log("Service is not running. Cleaning up state.");
      managedServiceStateStore.clear();
      return;
    }

    console.log(`Stopping ${APP_NAME} (PID ${state.pid})...`);
    try {
      process.kill(state.pid, "SIGTERM");
    } catch (error) {
      console.error(`Failed to stop service: ${String(error)}`);
      return;
    }

    const stopped = await waitForExit(state.pid, 3000);
    if (!stopped) {
      try {
        process.kill(state.pid, "SIGKILL");
      } catch (error) {
        console.error(`Failed to force stop service: ${String(error)}`);
        return;
      }
      await waitForExit(state.pid, 2000);
    }

    managedServiceStateStore.clear();
    localUiRuntimeStore.clearIfOwnedByProcess(state.pid);
    console.log(`✓ ${APP_NAME} stopped`);
  };

  private handleExistingManagedService = async (params: {
    existing: ManagedServiceState;
    uiConfig: Config["ui"];
    options: StartServiceOptions;
  }): Promise<boolean> => {
    const { existing, options, uiConfig } = params;
    console.log(`✓ ${APP_NAME} is already running (PID ${existing.pid})`);
    console.log(`UI: ${existing.uiUrl}`);
    console.log(`API: ${existing.apiUrl}`);

    const binding = resolveManagedServiceUiBinding(existing);
    if (binding.host !== uiConfig.host || binding.port !== uiConfig.port) {
      console.log(
        `Detected running service UI bind (${binding.host}:${binding.port}); enforcing (${uiConfig.host}:${uiConfig.port})...`
      );
      await this.stopService();
      const stateAfterStop = managedServiceStateStore.read();
      if (stateAfterStop && isProcessRunning(stateAfterStop.pid)) {
        process.exitCode = 1;
        console.error("Error: Failed to stop running service while enforcing public UI exposure.");
        return true;
      }
      await this.startService(options);
      return true;
    }

    await this.deps.printPublicUiUrls(binding.host, binding.port);
    console.log(`Logs: ${existing.logPath}`);
    this.deps.printServiceControlHints();
    return true;
  };

  private reuseExistingHealthyStartTarget = async (params: {
    uiConfig: Config["ui"];
    uiUrl: string;
    apiUrl: string;
    open: boolean;
  }): Promise<void> => {
    const { apiUrl, open, uiConfig, uiUrl } = params;
    console.log(`✓ ${APP_NAME} is already serving the target UI/API port`);
    console.log(`UI: ${uiUrl}`);
    console.log(`API: ${apiUrl}`);
    console.warn(
      [
        `Warning: The healthy listener on ${uiConfig.port} is not tracked by ${managedServiceStateStore.path}.`,
        "This start call reused the existing runtime instead of spawning another one.",
        "Use the owning process or port-level tools to stop it; managed stop/restart will not control it automatically."
      ].join(" ")
    );
    await this.deps.printPublicUiUrls(uiConfig.host, uiConfig.port);
    if (open) {
      openBrowser(uiUrl);
    }
  };

  private startNewManagedServiceTarget = async (params: {
    config: Config;
    uiConfig: Config["ui"];
    uiUrl: string;
    apiUrl: string;
    healthUrl: string;
    startupTimeoutMs?: number;
  }): Promise<void> => {
    const { apiUrl, config, healthUrl, startupTimeoutMs, uiConfig, uiUrl } = params;
    const startup = spawnManagedService({
      appName: APP_NAME,
      config,
      uiConfig,
      uiUrl,
      apiUrl,
      healthUrl,
      startupTimeoutMs,
      resolveStartupTimeoutMs: this.resolveStartupTimeoutMs,
      appendStartupStage: this.appendStartupStage,
      printStartupFailureDiagnostics: this.printStartupFailureDiagnostics,
      resolveServiceLogPath
    });
    if (!startup) {
      this.serviceLogger.fatal("managed service startup aborted", {
        reason: "child_process_not_created"
      });
      process.exitCode = 1;
      return;
    }

    const readiness = await waitForManagedServiceReadiness({
      appName: APP_NAME,
      childPid: startup.snapshot.pid,
      healthUrl,
      logPath: startup.logPath,
      readinessTimeoutMs: startup.readinessTimeoutMs,
      quickPhaseTimeoutMs: startup.quickPhaseTimeoutMs,
      extendedPhaseTimeoutMs: startup.extendedPhaseTimeoutMs,
      appendStartupStage: this.appendStartupStage,
      waitForBackgroundServiceReady: this.waitForBackgroundServiceReady,
      isProcessRunning
    });
    if (!readiness.ready && !isProcessRunning(startup.snapshot.pid)) {
      process.exitCode = 1;
      managedServiceStateStore.clear();
      const hint = readiness.lastProbeError ? ` Last probe error: ${readiness.lastProbeError}` : "";
      this.appendStartupStage(startup.logPath, `startup failed: process exited before ready.${hint}`);
      this.serviceLogger.fatal("managed service exited before readiness completed", {
        uiUrl,
        apiUrl,
        healthUrl,
        logPath: startup.logPath,
        ...(readiness.lastProbeError ? { lastProbeError: readiness.lastProbeError } : {}),
      });
      console.error(`Error: Failed to start background service. Check logs: ${startup.logPath}.${hint}`);
      this.printStartupFailureDiagnostics({
        uiUrl,
        apiUrl,
        healthUrl,
        logPath: startup.logPath,
        lastProbeError: readiness.lastProbeError
      });
      return;
    }

    startup.child.unref();
    const state = writeReadyManagedServiceState({
      readinessTimeoutMs: startup.readinessTimeoutMs,
      readiness,
      snapshot: startup.snapshot
    });
    await reportManagedServiceStart({
      appName: APP_NAME,
      state,
      uiConfig,
      uiUrl,
      apiUrl,
      readinessTimeoutMs: startup.readinessTimeoutMs,
      readiness,
      printPublicUiUrls: this.deps.printPublicUiUrls,
      printServiceControlHints: this.deps.printServiceControlHints
    });
  };

  private waitForBackgroundServiceReady = async (params: { pid: number; healthUrl: string; timeoutMs: number }): Promise<{ ready: boolean; lastProbeError: string | null }> => {
    const { pid, healthUrl, timeoutMs } = params;
    const startedAt = Date.now();
    let lastProbeError: string | null = null;
    while (Date.now() - startedAt < timeoutMs) {
      if (!isProcessRunning(pid)) {
        return { ready: false, lastProbeError };
      }
      const probe = await probeHealthEndpoint(healthUrl);
      if (!probe.healthy) {
        lastProbeError = probe.error;
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
        continue;
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
      if (isProcessRunning(pid)) {
        return { ready: true, lastProbeError: null };
      }
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
    }
    return { ready: false, lastProbeError };
  };

  private resolveStartupTimeoutMs = (overrideTimeoutMs: number | undefined): number => {
    const fallback = process.platform === "win32" ? 28000 : 33000;
    const envRaw = process.env.NEXTCLAW_START_TIMEOUT_MS?.trim();
    const envValue = envRaw ? Number(envRaw) : Number.NaN;
    const fromEnv = Number.isFinite(envValue) && envValue > 0 ? Math.floor(envValue) : null;
    const fromOverride = Number.isFinite(overrideTimeoutMs) && Number(overrideTimeoutMs) > 0
      ? Math.floor(Number(overrideTimeoutMs))
      : null;
    const resolved = fromOverride ?? fromEnv ?? fallback;
    return Math.max(3000, resolved);
  };

  private appendStartupStage = (logPath: string, message: string): void => {
    try {
      this.serviceLogger.child("startup").info(message, { logPath });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`Warning: failed to write startup diagnostics log (${logPath}): ${detail}`);
    }
  };

  private printStartupFailureDiagnostics = (params: { uiUrl: string; apiUrl: string; healthUrl: string; logPath: string; lastProbeError: string | null }): void => {
    const { apiUrl, healthUrl, lastProbeError, logPath, uiUrl } = params;
    const statePath = managedServiceStateStore.path;
    const lines = [
      "Startup diagnostics:",
      `- UI URL: ${uiUrl}`,
      `- API URL: ${apiUrl}`,
      `- Health probe: ${healthUrl}`,
      `- Service state path: ${statePath}`,
      `- Startup log path: ${logPath}`
    ];
    if (lastProbeError) {
      lines.push(`- Last probe detail: ${lastProbeError}`);
    }
    console.error(lines.join("\n"));
  };

}
