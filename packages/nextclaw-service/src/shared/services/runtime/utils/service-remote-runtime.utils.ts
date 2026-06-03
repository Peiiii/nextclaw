import type { Config } from "@nextclaw/core";
import { RemoteServiceModule, type RemoteRuntimeState } from "@nextclaw/remote";
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
import { getRunPath } from "@nextclaw/core";
import { resolveUiApiBase, isProcessRunning } from "@nextclaw-service/shared/utils/cli.utils.js";
import {
  managedServiceStateStore,
  type ManagedServiceLease,
  type ManagedServiceState
} from "@nextclaw-service/shared/stores/managed-service-state.store.js";
import {
  buildNextclawConfiguredRemoteState,
  createNextclawRemoteConnector,
  createNextclawRemoteStatusStore
} from "@nextclaw-service/commands/remote/utils/remote-runtime-support.utils.js";

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
  return resolve(getRunPath(), "remote-owner.lock.json");
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
  const { claim, currentPid, isProcessRunningFn, lockPath } = params;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(lockPath, "wx");
      writeFileSync(fd, `${JSON.stringify(claim, null, 2)}\n`, "utf-8");
      closeSync(fd);
      return {
        ok: true,
        release: createRemoteOwnershipRelease({
          lockPath,
          claim
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

      const existing = readRemoteOwnershipRecord(lockPath);
      if (existing && existing.pid !== currentPid && isProcessRunningFn(existing.pid)) {
        return {
          ok: false,
          error: buildLocalProcessOwnershipError(existing)
        };
      }

      removeRemoteOwnershipLock(lockPath);
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
  const {
    localOrigin,
    lockPath: lockPathOverride,
    currentPid: currentPidOverride,
    now: nowOverride,
    isProcessRunningFn: isProcessRunningOverride,
    readServiceStateFn: readServiceStateOverride
  } = params;
  const lockPath = lockPathOverride ?? resolveRemoteOwnershipLockPath();
  const currentPid = currentPidOverride ?? process.pid;
  const now = nowOverride ?? (() => new Date().toISOString());
  const isProcessRunningFn = isProcessRunningOverride ?? isProcessRunning;
  const readServiceStateFn = readServiceStateOverride ?? managedServiceStateStore.read;
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
      localOrigin,
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
  onRemoteStateChange?: (state: RemoteRuntimeState) => void;
}): RemoteServiceModule | null {
  const { loadConfig, localOrigin, onRemoteStateChange, uiEnabled } = params;
  if (!uiEnabled) {
    return null;
  }
  return new RemoteServiceModule({
    loadConfig,
    uiEnabled,
    localOrigin,
    statusStore: createNextclawRemoteStatusStore("service", onRemoteStateChange),
    createConnector: (logger) => createNextclawRemoteConnector({ logger }),
    claimOwnership: () => claimManagedRemoteRuntimeOwnership({ localOrigin }),
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
  localOriginOverride?: string; onRemoteStateChange?: (state: RemoteRuntimeState) => void;
}): RemoteServiceModule | null {
  const { loadConfig, localOriginOverride, onRemoteStateChange, uiConfig } = params;
  const explicitLocalOrigin = localOriginOverride?.trim() ?? process.env.NEXTCLAW_REMOTE_LOCAL_ORIGIN?.trim();
  return createManagedRemoteModule({
    loadConfig,
    uiEnabled: uiConfig.enabled,
    onRemoteStateChange,
    localOrigin:
      explicitLocalOrigin && explicitLocalOrigin.length > 0
        ? explicitLocalOrigin.replace(/\/+$/, "")
        : resolveUiApiBase(uiConfig.host, uiConfig.port)
  });
}

export function writeInitialManagedServiceState(params: {
  config: Config;
  lease?: ManagedServiceLease;
  readinessTimeoutMs: number;
  snapshot: ManagedServiceSnapshot;
}): void {
  const { config, lease, readinessTimeoutMs, snapshot } = params;
  managedServiceStateStore.write({
    pid: snapshot.pid,
    startedAt: new Date().toISOString(),
    uiUrl: snapshot.uiUrl,
    apiUrl: snapshot.apiUrl,
    uiHost: snapshot.uiHost,
    uiPort: snapshot.uiPort,
    logPath: snapshot.logPath,
    ...(lease ? { lease } : {}),
    startupLastProbeError: null,
    startupTimeoutMs: readinessTimeoutMs,
    startupCheckedAt: new Date().toISOString(),
    ...(config.remote.enabled ? { remote: buildNextclawConfiguredRemoteState(config) } : {})
  });
}

export function writeReadyManagedServiceState(params: {
  lease?: ManagedServiceLease;
  readinessTimeoutMs: number;
  readiness: { ready: boolean; lastProbeError: string | null };
  snapshot: ManagedServiceSnapshot;
}): ManagedServiceState {
  const { lease, readiness, readinessTimeoutMs, snapshot } = params;
  const currentState = managedServiceStateStore.read();
  const state: ManagedServiceState = {
    pid: snapshot.pid,
    startedAt: currentState?.startedAt ?? new Date().toISOString(),
    uiUrl: snapshot.uiUrl,
    apiUrl: snapshot.apiUrl,
    uiHost: snapshot.uiHost,
    uiPort: snapshot.uiPort,
    logPath: snapshot.logPath,
    ...(lease ? { lease } : currentState?.lease ? { lease: currentState.lease } : {}),
    startupState: readiness.ready ? "ready" : "degraded",
    startupLastProbeError: readiness.lastProbeError,
    startupTimeoutMs: readinessTimeoutMs,
    startupCheckedAt: new Date().toISOString(),
    ...(currentState?.remote ? { remote: currentState.remote } : {})
  };
  managedServiceStateStore.write(state);
  return state;
}
