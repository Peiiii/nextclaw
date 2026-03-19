import type { Config } from "@nextclaw/core";
import { RemoteServiceModule } from "@nextclaw/remote";
import { readServiceState, writeServiceState, type ServiceState } from "../utils.js";
import {
  buildNextclawConfiguredRemoteState,
  createNextclawRemoteConnector,
  createNextclawRemoteStatusStore
} from "./remote-runtime-support.js";

type ManagedServiceSnapshot = {
  pid: number;
  uiUrl: string;
  apiUrl: string;
  uiHost: string;
  uiPort: number;
  logPath: string;
};

export function createManagedRemoteModule(params: {
  config: Config;
  localOrigin: string;
}): RemoteServiceModule | null {
  if (!params.config.ui.enabled) {
    return null;
  }
  return new RemoteServiceModule({
    config: params.config,
    localOrigin: params.localOrigin,
    statusStore: createNextclawRemoteStatusStore("service"),
    createConnector: (logger) => createNextclawRemoteConnector({ logger }),
    logger: {
      info: (message) => console.log(`[remote] ${message}`),
      warn: (message) => console.warn(`[remote] ${message}`),
      error: (message) => console.error(`[remote] ${message}`)
    }
  });
}

export function writeInitialManagedServiceState(params: {
  config: Config;
  readinessTimeoutMs: number;
  snapshot: ManagedServiceSnapshot;
}): void {
  writeServiceState({
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
}): ServiceState {
  const currentState = readServiceState();
  const state: ServiceState = {
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
  writeServiceState(state);
  return state;
}
