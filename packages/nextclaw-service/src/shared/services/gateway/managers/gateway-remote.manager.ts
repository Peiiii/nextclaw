import type { UiRemoteAccessHost } from "@nextclaw/server";
import { createManagedRemoteModuleForUi } from "@nextclaw-service/shared/services/runtime/service-remote-runtime.service.js";
import { createRemoteAccessHost } from "@nextclaw-service/shared/services/ui/service-remote-access.service.js";
import type { GatewayConfigManager } from "./gateway-config.manager.js";
import type { GatewayRuntimeDeps } from "../nextclaw-gateway-runtime.service.js";

type RemoteServiceModule = ReturnType<typeof createManagedRemoteModuleForUi>;

export class GatewayRemoteManager {
  readonly remoteModule: RemoteServiceModule;
  readonly remoteAccess: UiRemoteAccessHost;

  constructor(params: {
    deps: GatewayRuntimeDeps;
    configManager: GatewayConfigManager;
  }) {
    const { configManager, deps } = params;
    this.remoteModule = createManagedRemoteModuleForUi({
      loadConfig: configManager.loadGatewayConfig,
      uiConfig: configManager.uiConfig,
    });
    this.remoteAccess = createRemoteAccessHost({
      serviceCommands: deps,
      requestRestart: deps.requestRestart,
      uiConfig: configManager.uiConfig,
      remoteModule: this.remoteModule,
    });
  }

  stop = async (): Promise<void> => {
    await this.remoteModule?.stop();
  };
}
