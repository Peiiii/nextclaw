import type { MarketplaceApiConfig } from "@nextclaw/server";
import { ServiceMarketplaceInstaller } from "@nextclaw-service/shared/services/marketplace/service-marketplace-installer.service.js";
import type { GatewayConfigManager } from "./gateway-config.manager.js";
import type { GatewayRuntimeDeps } from "../nextclaw-gateway-runtime.service.js";

export class GatewayMarketplaceManager {
  readonly marketplace: MarketplaceApiConfig;

  constructor(params: {
    deps: GatewayRuntimeDeps;
    configManager: GatewayConfigManager;
  }) {
    this.marketplace = {
      apiBaseUrl: process.env.NEXTCLAW_MARKETPLACE_API_BASE,
      installer: new ServiceMarketplaceInstaller({
        applyLiveConfigReload: params.configManager.applyLiveConfigReload,
        runCliSubcommand: params.deps.runCliSubcommand,
        installBuiltinSkill: params.deps.installBuiltinMarketplaceSkill,
      }).createInstaller(),
    };
  }
}
