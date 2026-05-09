import type { Config } from "@nextclaw/core";
import type { RemoteServiceModule } from "@nextclaw/remote";
import type { UiRemoteAccessHost, UiRuntimeControlHost, UiRuntimeUpdateHost } from "@nextclaw/server";
import type { RequestRestartParams } from "@nextclaw-service/shared/types/cli.types.js";
import { createNpmRuntimeUpdateHost } from "@nextclaw-service/shared/services/ui/npm-runtime-update-host.service.js";
import { createRuntimeControlHost } from "@nextclaw-service/shared/services/ui/runtime-control-host.service.js";
import { createRemoteAccessHost } from "@nextclaw-service/shared/services/ui/service-remote-access.service.js";
import { managedServiceStateStore } from "@nextclaw-service/shared/stores/managed-service-state.store.js";

function resolveApplyRestartMode(uiPort: number): "managed-service-restart" | "manual-process-restart" {
  const serviceState = managedServiceStateStore.read();
  if (serviceState?.pid === process.pid) {
    return "managed-service-restart";
  }
  if (
    process.env.NEXTCLAW_RUNTIME_BUNDLE_CHILD === "1" &&
    typeof serviceState?.uiPort === "number" &&
    serviceState.uiPort === uiPort
  ) {
    return "managed-service-restart";
  }
  return "manual-process-restart";
}

export function createServiceUiHosts(params: {
  serviceCommands: {
    startService: (options: { uiOverrides: Record<string, unknown>; open: boolean }) => Promise<void>;
    stopService: () => Promise<void>;
  };
  requestRestart: (params: RequestRestartParams) => Promise<void>;
  uiConfig: Pick<Config["ui"], "host" | "port">;
  remoteModule: RemoteServiceModule | null;
}): {
  remoteAccess: UiRemoteAccessHost;
  runtimeControl: UiRuntimeControlHost;
  runtimeUpdate?: UiRuntimeUpdateHost;
} {
  const { requestRestart, serviceCommands, uiConfig } = params;
  const applyRestartMode = resolveApplyRestartMode(uiConfig.port);
  return {
    remoteAccess: createRemoteAccessHost(params),
    runtimeControl: createRuntimeControlHost({
      serviceCommands,
      requestRestart,
      uiConfig
    }),
    runtimeUpdate:
      process.env.NEXTCLAW_DISABLE_RUNTIME_UPDATE_HOST === "1"
        ? undefined
        : createNpmRuntimeUpdateHost({
            applyRestartMode,
            requestRestart,
            uiConfig
          })
  };
}
