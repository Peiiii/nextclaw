import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as NextclawCore from "@nextclaw/core";
import { FileLogSink } from "@nextclaw/core";
import {
  managedServiceStateStore,
  type ManagedServiceLastExit,
  type ManagedServiceLease,
  type ManagedServiceState,
  type ManagedServiceStateStore
} from "@nextclaw-service/stores/managed-service-state.store.js";
import { writeInitialManagedServiceState, writeReadyManagedServiceState } from "@nextclaw-service/utils/runtime/service-remote-runtime.utils.js";
import type { ManagedServiceSnapshot } from "@nextclaw-service/utils/runtime/managed-service-routing.utils.js";
import { resolveCliSubcommandLaunch } from "@nextclaw-service/utils/marketplace/cli-subcommand-launch.utils.js";
import { createTopLevelNextclawCommandEnv } from "@nextclaw-service/utils/top-level-nextclaw-command-env.utils.js";
import { isProcessRunning, resolveServiceLogPath } from "@nextclaw-service/utils/cli.utils.js";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 2_000;
const DEFAULT_LEASE_TTL_MS = 10_000;
const SIGNAL_EXIT_CODES: Record<string, number> = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143
};

type Config = NextclawCore.Config;

type ManagedServiceStartup = {
  child: ChildProcess;
  logPath: string;
  readinessTimeoutMs: number;
  quickPhaseTimeoutMs: number;
  extendedPhaseTimeoutMs: number;
  snapshot: ManagedServiceSnapshot;
};

type ManagedServiceLiveness = {
  processExists: boolean;
  running: boolean;
  staleState: boolean;
  staleReason: "process-not-running" | "lease-expired" | null;
  leaseExpired: boolean;
  leaseMissing: boolean;
  lastHeartbeatAt: string | null;
};

type ManagedServiceSupervisorOptions = {
  stateStore?: ManagedServiceStateStore;
  now?: () => Date;
  isProcessRunningFn?: (pid: number) => boolean;
  heartbeatIntervalMs?: number;
  leaseTtlMs?: number;
};

export class ManagedServiceSupervisor {
  private readonly stateStore: ManagedServiceStateStore;
  private readonly now: () => Date;
  private readonly isProcessRunningFn: (pid: number) => boolean;
  private readonly heartbeatIntervalMs: number;
  private readonly leaseTtlMs: number;
  private readonly serviceStartupLogger = NextclawCore.getAppLogger("service.startup");
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lifecycleTrackingInstalled = false;
  private pendingExit: ManagedServiceLastExit | null = null;

  constructor(options: ManagedServiceSupervisorOptions = {}) {
    this.stateStore = options.stateStore ?? managedServiceStateStore;
    this.now = options.now ?? (() => new Date());
    this.isProcessRunningFn = options.isProcessRunningFn ?? isProcessRunning;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.leaseTtlMs = options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS;
  }

  spawnManagedService = (params: {
    appName: string;
    config: Config;
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
    resolveServiceLogPath?: () => string;
  }): ManagedServiceStartup | null => {
    const {
      appName,
      apiUrl,
      appendStartupStage,
      config,
      healthUrl,
      printStartupFailureDiagnostics,
      resolveStartupTimeoutMs,
      startupTimeoutMs,
      uiConfig,
      uiUrl
    } = params;
    const logPath = (params.resolveServiceLogPath ?? resolveServiceLogPath)();
    new FileLogSink({ serviceLogPath: logPath }).ensureReady();
    mkdirSync(dirname(logPath), { recursive: true });
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
      env: createTopLevelNextclawCommandEnv(process.env),
      stdio: "ignore",
      detached: true,
      windowsHide: true
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
      lease: this.createLease(child.pid),
      readinessTimeoutMs,
      snapshot
    });
    this.serviceStartupLogger.info("runtime.process.started", {
      runtimeKind: "managed-service",
      childPid: child.pid,
      uiUrl,
      apiUrl,
      uiHost: uiConfig.host,
      uiPort: uiConfig.port,
      entrypoint: `${cliLaunch.command} ${childArgs.join(" ")}`
    });
    this.serviceStartupLogger.info("service_state.written", {
      runtimeKind: "managed-service",
      childPid: child.pid,
      statePath: this.stateStore.path,
      uiUrl,
      apiUrl
    });
    return {
      child,
      logPath,
      readinessTimeoutMs,
      quickPhaseTimeoutMs,
      extendedPhaseTimeoutMs,
      snapshot
    };
  };

  writeReadyState = (params: {
    readinessTimeoutMs: number;
    readiness: { ready: boolean; lastProbeError: string | null };
    snapshot: ManagedServiceSnapshot;
  }): ManagedServiceState => {
    return writeReadyManagedServiceState({
      ...params,
      lease: this.createLease(params.snapshot.pid)
    });
  };

  installCurrentProcessLifecycleTracking = (): void => {
    if (this.lifecycleTrackingInstalled) {
      return;
    }
    this.lifecycleTrackingInstalled = true;
    this.startHeartbeatForCurrentProcess();

    for (const signal of ["SIGHUP", "SIGINT", "SIGTERM"] as const) {
      process.once(signal, () => {
        this.pendingExit = {
          pid: process.pid,
          reason: "signal",
          exitedAt: this.now().toISOString(),
          code: SIGNAL_EXIT_CODES[signal],
          signal
        };
        this.recordCurrentProcessExit(this.pendingExit);
        this.stopHeartbeat();
        process.exit(SIGNAL_EXIT_CODES[signal]);
      });
    }

    process.once("uncaughtExceptionMonitor", (error) => {
      this.pendingExit = {
        pid: process.pid,
        reason: "uncaughtException",
        exitedAt: this.now().toISOString(),
        message: error instanceof Error ? error.message : String(error)
      };
    });

    process.once("exit", (code) => {
      this.recordCurrentProcessExit({
        ...(this.pendingExit ?? {
          pid: process.pid,
          reason: "exit",
          exitedAt: this.now().toISOString()
        }),
        code
      });
      this.stopHeartbeat();
    });
  };

  startHeartbeatForCurrentProcess = (pid = process.pid): void => {
    if (this.heartbeatTimer) {
      return;
    }
    if (!this.writeHeartbeat(pid)) {
      return;
    }
    this.heartbeatTimer = setInterval(() => {
      if (!this.writeHeartbeat(pid)) {
        this.stopHeartbeat();
      }
    }, this.heartbeatIntervalMs);
    this.heartbeatTimer.unref();
  };

  stopHeartbeatForCurrentProcess = (): void => {
    this.stopHeartbeat();
  };

  resolveStateLiveness = (state: ManagedServiceState | null): ManagedServiceLiveness => {
    if (!state) {
      return {
        processExists: false,
        running: false,
        staleState: false,
        staleReason: null,
        leaseExpired: false,
        leaseMissing: false,
        lastHeartbeatAt: null
      };
    }

    const processExists = this.isProcessRunningFn(state.pid);
    const leaseStatus = this.resolveLeaseStatus(state.lease);
    if (!processExists) {
      return {
        processExists,
        running: false,
        staleState: true,
        staleReason: "process-not-running",
        leaseExpired: leaseStatus.expired,
        leaseMissing: leaseStatus.missing,
        lastHeartbeatAt: leaseStatus.heartbeatAt
      };
    }
    if (leaseStatus.expired) {
      return {
        processExists,
        running: false,
        staleState: true,
        staleReason: "lease-expired",
        leaseExpired: true,
        leaseMissing: false,
        lastHeartbeatAt: leaseStatus.heartbeatAt
      };
    }
    return {
      processExists,
      running: true,
      staleState: false,
      staleReason: null,
      leaseExpired: false,
      leaseMissing: leaseStatus.missing,
      lastHeartbeatAt: leaseStatus.heartbeatAt
    };
  };

  private writeHeartbeat = (pid: number): boolean => {
    let wrote = false;
    this.stateStore.update((state) => {
      if (state.pid !== pid) {
        return state;
      }
      wrote = true;
      const next: ManagedServiceState = {
        ...state,
        lease: {
          ...(state.lease ?? this.createLease(pid)),
          ownerPid: pid,
          heartbeatAt: this.now().toISOString(),
          heartbeatIntervalMs: this.heartbeatIntervalMs,
          ttlMs: this.leaseTtlMs
        }
      };
      delete next.lastExit;
      return next;
    });
    return wrote;
  };

  recordCurrentProcessExit = (exit: ManagedServiceLastExit): void => {
    this.stateStore.update((state) => {
      if (state.pid !== exit.pid) {
        return state;
      }
      return {
        ...state,
        lastExit: exit
      };
    });
  };

  private stopHeartbeat = (): void => {
    if (!this.heartbeatTimer) {
      return;
    }
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  };

  private readonly createLease = (ownerPid: number): ManagedServiceLease => ({
    ownerPid,
    heartbeatAt: this.now().toISOString(),
    heartbeatIntervalMs: this.heartbeatIntervalMs,
    ttlMs: this.leaseTtlMs
  });

  private resolveLeaseStatus = (lease: ManagedServiceLease | undefined): {
    expired: boolean;
    missing: boolean;
    heartbeatAt: string | null;
  } => {
    if (!lease) {
      return {
        expired: false,
        missing: true,
        heartbeatAt: null
      };
    }
    const heartbeatAtMs = Date.parse(lease.heartbeatAt);
    const ttlMs = Number.isFinite(lease.ttlMs) ? lease.ttlMs : this.leaseTtlMs;
    return {
      expired: !Number.isFinite(heartbeatAtMs) || heartbeatAtMs + ttlMs < this.now().getTime(),
      missing: false,
      heartbeatAt: lease.heartbeatAt
    };
  };
}
