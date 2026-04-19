import type { Config } from "@nextclaw/core";
import { RemoteServiceModule } from "@nextclaw/remote";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { getDataDir } from "@nextclaw/core";
import { resolveUiApiBase, isProcessRunning } from "@/cli/shared/utils/cli.utils.js";
import {
  managedServiceStateStore,
  type ManagedServiceState
} from "@/cli/shared/stores/managed-service-state.store.js";
import {
  buildNextclawConfiguredRemoteState,
  createNextclawRemoteConnector,
  createNextclawRemoteStatusStore
} from "@/cli/commands/remote/services/remote-runtime-support.service.js";

type ManagedServiceSnapshot = {
  pid: number;
  uiUrl: string;
  apiUrl: string;
  uiHost: string;
  uiPort: number;
  logPath: string;
};

type RemoteRuntimeOwnerRecord = {
  pid: number;
  localOrigin: string;
  claimedAt: string;
};

type RemoteRuntimeOwnershipClaim = { ok: true; release: () => void } | { ok: false; error: string };

function resolveRemoteOwnershipLockPath(): string {
  return resolve(getDataDir(), "run", "remote-owner.lock.json");
}

function readRemoteOwnershipRecord(lockPath: string): RemoteRuntimeOwnerRecord | null {
  try {
    const raw = JSON.parse(readFileSync(lockPath, "utf-8")) as Partial<RemoteRuntimeOwnerRecord>;
    if (typeof raw.pid !== "number" || !Number.isFinite(raw.pid)) {
      return null;
    }
    return {
      pid: raw.pid,
      localOrigin: typeof raw.localOrigin === "string" ? raw.localOrigin : "",
      claimedAt: typeof raw.claimedAt === "string" ? raw.claimedAt : ""
    };
  } catch {
    return null;
  }
}

function removeRemoteOwnershipLock(lockPath: string): void {
  if (!existsSync(lockPath)) {
    return;
  }
  try {
    unlinkSync(lockPath);
  } catch {
    try {
      rmSync(lockPath, { force: true });
    } catch {
      // Ignore cleanup failures.
    }
  }
}

function buildManagedServiceOwnershipError(params: {
  pid: number;
  ownerOrigin?: string;
}): string {
  return (
    `Remote access is already owned by running NextClaw service PID ${params.pid}`
    + `${params.ownerOrigin ? ` (${params.ownerOrigin})` : ""}. `
    + "Stop that service or disable remote there before starting another process with the same NEXTCLAW_HOME."
  );
}

function buildLocalProcessOwnershipError(record: RemoteRuntimeOwnerRecord): string {
  const originText = record.localOrigin ? ` (${record.localOrigin})` : "";
  return (
    `Remote access is already owned by local NextClaw process PID ${record.pid}${originText}. `
    + "Stop that process or use a different NEXTCLAW_HOME before starting another remote-enabled process."
  );
}

function createRemoteOwnershipRelease(params: {
  lockPath: string;
  claim: RemoteRuntimeOwnerRecord;
}): () => void {
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const current = readRemoteOwnershipRecord(params.lockPath);
    if (!current || (current.pid === params.claim.pid && current.claimedAt === params.claim.claimedAt)) {
      removeRemoteOwnershipLock(params.lockPath);
    }
  };
}

function detectManagedRemoteOwnershipConflict(params: {
  currentPid: number;
  isProcessRunningFn: (pid: number) => boolean;
  readServiceStateFn: () => ManagedServiceState | null;
}): string | null {
  const runningService = params.readServiceStateFn();
  if (
    !runningService
    || runningService.pid === params.currentPid
    || !params.isProcessRunningFn(runningService.pid)
    || !runningService.remote?.enabled
  ) {
    return null;
  }

  return buildManagedServiceOwnershipError({
    pid: runningService.pid,
    ownerOrigin: runningService.remote.localOrigin ?? runningService.uiUrl
  });
}

function tryClaimRemoteOwnershipLock(params: {
  lockPath: string;
  claim: RemoteRuntimeOwnerRecord;
  currentPid: number;
  isProcessRunningFn: (pid: number) => boolean;
}): RemoteRuntimeOwnershipClaim {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(params.lockPath, "wx");
      writeFileSync(fd, `${JSON.stringify(params.claim, null, 2)}\n`, "utf-8");
      closeSync(fd);
      return {
        ok: true,
        release: createRemoteOwnershipRelease({
          lockPath: params.lockPath,
          claim: params.claim
        })
      };
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "EEXIST") {
        return {
          ok: false,
          error: `Failed to claim local remote runtime ownership: ${error instanceof Error ? error.message : String(error)}`
        };
      }

      const existing = readRemoteOwnershipRecord(params.lockPath);
      if (existing && existing.pid !== params.currentPid && params.isProcessRunningFn(existing.pid)) {
        return {
          ok: false,
          error: buildLocalProcessOwnershipError(existing)
        };
      }

      removeRemoteOwnershipLock(params.lockPath);
    }
  }

  return {
    ok: false,
    error: "Failed to claim local remote runtime ownership after clearing a stale lock."
  };
}

export function claimManagedRemoteRuntimeOwnership(params: {
  localOrigin: string;
  lockPath?: string;
  currentPid?: number;
  now?: () => string;
  isProcessRunningFn?: (pid: number) => boolean;
  readServiceStateFn?: () => ManagedServiceState | null;
}): RemoteRuntimeOwnershipClaim {
  const lockPath = params.lockPath ?? resolveRemoteOwnershipLockPath();
  const currentPid = params.currentPid ?? process.pid;
  const now = params.now ?? (() => new Date().toISOString());
  const isProcessRunningFn = params.isProcessRunningFn ?? isProcessRunning;
  const readServiceStateFn = params.readServiceStateFn ?? managedServiceStateStore.read;
  const managedConflict = detectManagedRemoteOwnershipConflict({
    currentPid,
    isProcessRunningFn,
    readServiceStateFn
  });
  if (managedConflict) {
    return {
      ok: false,
      error: managedConflict
    };
  }

  mkdirSync(dirname(lockPath), { recursive: true });
  return tryClaimRemoteOwnershipLock({
    lockPath,
    claim: {
      pid: currentPid,
      localOrigin: params.localOrigin,
      claimedAt: now()
    },
    currentPid,
    isProcessRunningFn
  });
}

export function createManagedRemoteModule(params: {
  loadConfig: () => Config;
  uiEnabled: boolean;
  localOrigin: string;
}): RemoteServiceModule | null {
  if (!params.uiEnabled) {
    return null;
  }
  return new RemoteServiceModule({
    loadConfig: params.loadConfig,
    uiEnabled: params.uiEnabled,
    localOrigin: params.localOrigin,
    statusStore: createNextclawRemoteStatusStore("service"),
    createConnector: (logger) => createNextclawRemoteConnector({ logger }),
    claimOwnership: () => claimManagedRemoteRuntimeOwnership({ localOrigin: params.localOrigin }),
    logger: {
      info: (message) => console.log(`[remote] ${message}`),
      warn: (message) => console.warn(`[remote] ${message}`),
      error: (message) => console.error(`[remote] ${message}`)
    }
  });
}

export function createManagedRemoteModuleForUi(params: {
  loadConfig: () => Config;
  uiConfig: Pick<Config["ui"], "enabled" | "host" | "port">;
  localOriginOverride?: string;
}): RemoteServiceModule | null {
  const explicitLocalOrigin = params.localOriginOverride?.trim() ?? process.env.NEXTCLAW_REMOTE_LOCAL_ORIGIN?.trim();
  return createManagedRemoteModule({
    loadConfig: params.loadConfig,
    uiEnabled: params.uiConfig.enabled,
    localOrigin:
      explicitLocalOrigin && explicitLocalOrigin.length > 0
        ? explicitLocalOrigin.replace(/\/+$/, "")
        : resolveUiApiBase(params.uiConfig.host, params.uiConfig.port)
  });
}

export function writeInitialManagedServiceState(params: {
  config: Config;
  readinessTimeoutMs: number;
  snapshot: ManagedServiceSnapshot;
}): void {
  managedServiceStateStore.write({
    pid: params.snapshot.pid,
    startedAt: new Date().toISOString(),
    uiUrl: params.snapshot.uiUrl,
    apiUrl: params.snapshot.apiUrl,
    uiHost: params.snapshot.uiHost,
    uiPort: params.snapshot.uiPort,
    logPath: params.snapshot.logPath,
    startupLastProbeError: null,
    startupTimeoutMs: params.readinessTimeoutMs,
    startupCheckedAt: new Date().toISOString(),
    ...(params.config.remote.enabled ? { remote: buildNextclawConfiguredRemoteState(params.config) } : {})
  });
}

export function writeReadyManagedServiceState(params: {
  readinessTimeoutMs: number;
  readiness: { ready: boolean; lastProbeError: string | null };
  snapshot: ManagedServiceSnapshot;
}): ManagedServiceState {
  const currentState = managedServiceStateStore.read();
  const state: ManagedServiceState = {
    pid: params.snapshot.pid,
    startedAt: currentState?.startedAt ?? new Date().toISOString(),
    uiUrl: params.snapshot.uiUrl,
    apiUrl: params.snapshot.apiUrl,
    uiHost: params.snapshot.uiHost,
    uiPort: params.snapshot.uiPort,
    logPath: params.snapshot.logPath,
    startupState: params.readiness.ready ? "ready" : "degraded",
    startupLastProbeError: params.readiness.lastProbeError,
    startupTimeoutMs: params.readinessTimeoutMs,
    startupCheckedAt: new Date().toISOString(),
    ...(currentState?.remote ? { remote: currentState.remote } : {})
  };
  managedServiceStateStore.write(state);
  return state;
}
