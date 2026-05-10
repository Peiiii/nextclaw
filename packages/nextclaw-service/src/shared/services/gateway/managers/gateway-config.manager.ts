import {
  ChannelManager,
  loadConfig,
  resolveConfigSecrets,
  type Config,
} from "@nextclaw/core";
import { resolveChannelConfigView } from "@nextclaw-service/commands/channel/channel-config-view.js";
import { ConfigReloader } from "@nextclaw-service/shared/services/config/config-reloader.service.js";
import type {
  GatewayRuntimeDeps,
  NextclawGatewayRuntime,
} from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";
import { measureStartupSync } from "@nextclaw-service/shared/utils/startup-trace.js";

export class GatewayConfigManager {
  readonly configPath: string;
  readonly config: Config;
  readonly uiConfig: Config["ui"];
  readonly uiStaticDir: string | null;
  readonly reloader: ConfigReloader;

  constructor(params: {
    configPath: string;
    config: Config;
    uiConfig: Config["ui"];
    uiStaticDir: string | null;
    deps: GatewayRuntimeDeps;
    gateway: NextclawGatewayRuntime;
  }) {
    const { config, configPath, uiConfig, uiStaticDir } = params;
    this.configPath = configPath;
    this.config = config;
    this.uiConfig = uiConfig;
    this.uiStaticDir = uiStaticDir;
    this.reloader = this.createReloader(params);
  }

  loadGatewayConfig = (): Config =>
    resolveConfigSecrets(loadConfig(), { configPath: this.configPath });

  applyLiveConfigReload = async (): Promise<void> => {
    await this.reloader.applyReloadPlan(this.loadGatewayConfig());
  };

  private createReloader = (params: {
    deps: GatewayRuntimeDeps;
    gateway: NextclawGatewayRuntime;
  }): ConfigReloader => {
    const { deps, gateway } = params;
    const channels = new ChannelManager(
      resolveChannelConfigView(this.config, gateway.plugins.getChannelBindings()),
      gateway.messageBus,
      gateway.sessionManager,
      gateway.plugins.getExtensionRegistry().channels,
    );
    return measureStartupSync(
      "service.gateway.config_reloader",
      () => new ConfigReloader({
        initialConfig: this.config,
        channels,
        bus: gateway.messageBus,
        sessionManager: gateway.sessionManager,
        providerManager: gateway.providerManager,
        makeProvider: (nextConfig) =>
          deps.createProvider(nextConfig, { allowMissing: true }) ?? deps.createMissingProvider(nextConfig),
        loadConfig: this.loadGatewayConfig,
        resolveChannelConfig: (nextConfig) => resolveChannelConfigView(nextConfig, gateway.plugins.getChannelBindings()),
        getExtensionChannels: () => gateway.plugins.getExtensionRegistry().channels,
        onRestartRequired: (paths) => {
          void deps.requestRestart({
            changedPaths: paths,
            manualMessage: `已保存以下改动，等待你手动重启后生效：${paths.join(", ")}`,
            mode: "notify",
            reason: `config reload requires restart: ${paths.join(", ")}`,
            strategy: "background-service-or-manual",
          });
        },
      })
    );
  };
}
