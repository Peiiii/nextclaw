import type * as NextclawCore from "@nextclaw/core";
import { FileLogSink } from "@nextclaw/core";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import type { ManagedServiceState } from "../../../shared/stores/managed-service-state.store.js";
import { resolveCliSubcommandLaunch } from "../marketplace/cli-subcommand-launch.js";
import { writeInitialManagedServiceState } from "./service-remote-runtime.js";

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
