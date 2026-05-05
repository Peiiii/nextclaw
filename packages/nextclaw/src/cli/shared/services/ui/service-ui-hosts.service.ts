import type { Config } from "@nextclaw/core";
import type { RemoteServiceModule } from "@nextclaw/remote";
import type { UiRemoteAccessHost, UiRuntimeControlHost, UiRuntimeUpdateHost } from "@nextclaw/server";
import type { RequestRestartParams } from "@/cli/shared/types/cli.types.js";
import { createNpmRuntimeUpdateHost } from "@/cli/shared/services/ui/npm-runtime-update-host.service.js";
import { createRuntimeControlHost } from "@/cli/shared/services/ui/runtime-control-host.service.js";
import { createRemoteAccessHost } from "@/cli/shared/services/ui/service-remote-access.service.js";

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
  runtimeUpdate: UiRuntimeUpdateHost;
} {
  const { requestRestart, serviceCommands, uiConfig } = params;
  return {
    remoteAccess: createRemoteAccessHost(params),
    runtimeControl: createRuntimeControlHost({
      serviceCommands,
      requestRestart,
      uiConfig
    }),
    runtimeUpdate: createNpmRuntimeUpdateHost({
      requestRestart,
      uiConfig
    })
  };
}
