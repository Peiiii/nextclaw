import type { Config } from "@nextclaw/core";
import type { RemoteServiceModule } from "@nextclaw/remote";
import type { UiRemoteAccessHost, UiRuntimeControlHost } from "@nextclaw/server";
import type { RequestRestartParams } from "../../../../shared/types/cli.types.js";
import { createRuntimeControlHost } from "./runtime-control-host.service.js";
import { createRemoteAccessHost } from "./service-remote-access.service.js";

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
} {
  return {
    remoteAccess: createRemoteAccessHost(params),
    runtimeControl: createRuntimeControlHost({
      serviceCommands: params.serviceCommands,
      requestRestart: params.requestRestart,
      uiConfig: params.uiConfig
    })
  };
}
