import type { UiRemoteAccessHost } from "@nextclaw/server";
import type { RemoteRuntimeState } from "@nextclaw/remote";
import type { ConfigManager } from "@nextclaw/kernel";
import type { Config } from "@nextclaw/core";
import { createManagedRemoteModuleForUi } from "@nextclaw-service/shared/services/runtime/utils/service-remote-runtime.utils.js";
import { createRemoteAccessHost } from "@nextclaw-service/shared/services/ui/service-remote-access.service.js";
import type { GatewayRuntimeDeps } from "../nextclaw-gateway-runtime.service.js";

type RemoteServiceModule = ReturnType<typeof createManagedRemoteModuleForUi>;

export class GatewayRemoteManager {
  readonly remoteModule: RemoteServiceModule;
  readonly remoteAccess: UiRemoteAccessHost;

  constructor(params: {
    deps: GatewayRuntimeDeps;
    configManager: ConfigManager;
    uiConfig: Config["ui"];
    onRemoteStateChange?: (state: RemoteRuntimeState) => void;
  }) {
    const { configManager, deps, uiConfig } = params;
    this.remoteModule = createManagedRemoteModuleForUi({
      loadConfig: configManager.loadConfig,
      uiConfig,
      onRemoteStateChange: params.onRemoteStateChange,
    });
    this.remoteAccess = createRemoteAccessHost({
      serviceCommands: deps,
      requestRestart: deps.requestRestart,
      uiConfig,
      remoteModule: this.remoteModule,
    });
  }

  stop = async (): Promise<void> => {
    await this.remoteModule?.stop();
  };
}
