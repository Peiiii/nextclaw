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
import {
  getPackageVersion,
  isProcessRunning
} from "../../../shared/utils/cli.utils.js";
import { localUiRuntimeStore } from "../../../shared/stores/local-ui-runtime.store.js";
import { managedServiceStateStore } from "../../../shared/stores/managed-service-state.store.js";
import { resolvePlatformApiBase } from "../utils/platform-api-base.utils.js";

let currentProcessRemoteRuntimeState: RemoteRuntimeState | null = null;

export function hasRunningNextclawManagedService(): boolean {
  const state = managedServiceStateStore.read();
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
      const state = managedServiceStateStore.read();
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
      currentProcessRemoteRuntimeState = next;
      const uiRuntimeState = localUiRuntimeStore.read();
      if (uiRuntimeState?.pid === process.pid) {
        localUiRuntimeStore.update((state) => ({
          ...state,
          remote: next
        }));
      }
      const serviceState = managedServiceStateStore.read();
      if (!serviceState || serviceState.pid !== process.pid) {
        return;
      }
      managedServiceStateStore.update((state) => ({
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
  const uiRuntimeState = localUiRuntimeStore.read();
  const serviceState = managedServiceStateStore.read();
  const currentRemoteState = currentProcessRemoteRuntimeState ?? uiRuntimeState?.remote ?? serviceState?.remote ?? null;
  if (!currentRemoteState) {
    return null;
  }

  const owningRuntime = uiRuntimeState ?? serviceState;
  if (!owningRuntime || isProcessRunning(owningRuntime.pid)) {
    return currentRemoteState;
  }

  return {
    ...currentRemoteState,
    state: currentRemoteState.enabled ? "disconnected" : "disabled",
    lastError: currentRemoteState.lastError ?? "Managed service is not running.",
    updatedAt: new Date().toISOString()
  };
}

export function resolveNextclawRemoteStatusSnapshot(config: Config): RemoteStatusSnapshot {
  return resolveRemoteStatusSnapshot({
    config,
    currentRemoteState: readCurrentNextclawRemoteRuntimeState()
  });
}
