import { resolveLocalUiBaseUrl, type Config } from "@nextclaw/core";
import { isProcessRunning } from "@/cli/shared/utils/cli.utils.js";
import {
  type LocalUiRuntimeState,
  type LocalUiRuntimeStore,
  localUiRuntimeStore
} from "@/cli/shared/stores/local-ui-runtime.store.js";
import {
  type ManagedServiceState,
  type ManagedServiceStateStore,
  managedServiceStateStore
} from "@/cli/shared/stores/managed-service-state.store.js";

type DiscoveredLocalUiState = LocalUiRuntimeState | ManagedServiceState;

export class LocalUiDiscoveryService {
  constructor(
    private readonly localUiStore: LocalUiRuntimeStore = localUiRuntimeStore,
    private readonly managedServiceStore: ManagedServiceStateStore = managedServiceStateStore,
    private readonly isProcessRunningFn: (pid: number) => boolean = (pid) => isProcessRunning(pid)
  ) {}

  private readonly readRunningState = (state: DiscoveredLocalUiState | null): DiscoveredLocalUiState | null => {
    if (!state || !this.isProcessRunningFn(state.pid)) {
      return null;
    }
    return state;
  };

  readonly readRunningRuntimeState = (): DiscoveredLocalUiState | null => {
    return this.readRunningState(this.localUiStore.read()) ?? this.readRunningState(this.managedServiceStore.read());
  };

  readonly resolveApiBase = (): string | null => {
    const state = this.readRunningRuntimeState();
    if (!state) {
      return null;
    }
    if (typeof state.uiUrl === "string" && state.uiUrl.trim().length > 0) {
      return state.uiUrl.replace(/\/+$/, "");
    }
    if (typeof state.apiUrl === "string" && state.apiUrl.trim().length > 0) {
      return state.apiUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
    }
    return null;
  };

  readonly resolveLocalOrigin = (config: Config): string => {
    const state = this.readRunningRuntimeState();
    const runtimePort =
      state && typeof state.uiPort === "number" && Number.isFinite(state.uiPort)
        ? state.uiPort
        : null;
    if (runtimePort !== null) {
      return resolveLocalUiBaseUrl({ host: "0.0.0.0", port: runtimePort });
    }
    const port = typeof config.ui.port === "number" && Number.isFinite(config.ui.port) ? config.ui.port : 55667;
    return resolveLocalUiBaseUrl({ host: "0.0.0.0", port });
  };
}

export const localUiDiscoveryService = new LocalUiDiscoveryService();
