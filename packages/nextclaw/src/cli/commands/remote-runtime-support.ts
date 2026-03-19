import { getConfigPath, getDataDir, loadConfig, type Config } from "@nextclaw/core";
import {
  RemoteConnector,
  RemotePlatformClient,
  RemoteStatusStore,
  buildConfiguredRemoteState,
  resolveRemoteStatusSnapshot,
  type RemoteLogger,
  type RemoteRuntimeState,
  type RemoteStatusSnapshot
} from "@nextclaw/remote";
import { getPackageVersion, isProcessRunning, readServiceState, updateServiceState } from "../utils.js";
import { resolvePlatformApiBase } from "./platform-api-base.js";

export function hasRunningNextclawManagedService(): boolean {
  const state = readServiceState();
  return Boolean(state && isProcessRunning(state.pid));
}

export function createNextclawRemotePlatformClient(): RemotePlatformClient {
  return new RemotePlatformClient({
    loadConfig: () => loadConfig(getConfigPath()),
    getDataDir,
    getPackageVersion,
    resolvePlatformBase: (rawApiBase) =>
      resolvePlatformApiBase({
        explicitApiBase: rawApiBase,
        requireConfigured: true
      }).platformBase,
    readManagedServiceState: () => {
      const state = readServiceState();
      if (!state) {
        return null;
      }
      return {
        pid: state.pid,
        uiPort: state.uiPort
      };
    },
    isProcessRunning
  });
}

export function createNextclawRemoteConnector(params: {
  logger?: RemoteLogger;
} = {}): RemoteConnector {
  return new RemoteConnector({
    platformClient: createNextclawRemotePlatformClient(),
    logger: params.logger
  });
}

export function createNextclawRemoteStatusStore(mode: RemoteRuntimeState["mode"]): RemoteStatusStore {
  return new RemoteStatusStore(mode, {
    writeRemoteState: (next) => {
      updateServiceState((state) => ({
        ...state,
        remote: next
      }));
    }
  });
}

export function buildNextclawConfiguredRemoteState(config: Config): RemoteRuntimeState {
  return buildConfiguredRemoteState(config);
}

export function readCurrentNextclawRemoteRuntimeState(): RemoteRuntimeState | null {
  return readServiceState()?.remote ?? null;
}

export function resolveNextclawRemoteStatusSnapshot(config: Config): RemoteStatusSnapshot {
  return resolveRemoteStatusSnapshot({
    config,
    currentRemoteState: readCurrentNextclawRemoteRuntimeState()
  });
}
