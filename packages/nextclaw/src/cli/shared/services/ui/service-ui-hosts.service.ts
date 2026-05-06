import type { Config } from "@nextclaw/core";
import type { RemoteServiceModule } from "@nextclaw/remote";
import type { UiRemoteAccessHost, UiRuntimeControlHost, UiRuntimeUpdateHost } from "@nextclaw/server";
import type { RequestRestartParams } from "@/cli/shared/types/cli.types.js";
import { createNpmRuntimeUpdateHost } from "@/cli/shared/services/ui/npm-runtime-update-host.service.js";
import { createRuntimeControlHost } from "@/cli/shared/services/ui/runtime-control-host.service.js";
import { createRemoteAccessHost } from "@/cli/shared/services/ui/service-remote-access.service.js";
import { managedServiceStateStore } from "@/cli/shared/stores/managed-service-state.store.js";

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
  const applyRestartMode =
    managedServiceStateStore.read()?.pid === process.pid ? "managed-service-restart" : "manual-process-restart";
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
