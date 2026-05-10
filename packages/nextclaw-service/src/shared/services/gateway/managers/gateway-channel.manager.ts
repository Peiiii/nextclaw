import type { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";
import { wrapStartChannelsWithDevPluginHotReload } from "../../plugin/utils/plugin-dev-hot-reload.utils.js";

const DEV_PLUGIN_HOT_RELOAD_STARTUP_SETTLE_MS = 5_000;

export class GatewayChannelManager {
  private deferredChannelStarter: () => Promise<void>;

  constructor(private readonly gateway: NextclawGatewayRuntime) {
    this.deferredChannelStarter = this.start;
  }

  reset = (): void => {
    this.deferredChannelStarter = this.start;
  };

  installDevHotReload = (): void => {
    this.deferredChannelStarter = wrapStartChannelsWithDevPluginHotReload({
      startChannels: this.start,
      watcherRegistry: this.gateway.fileWatchers,
      isRuntimeActive: () => true,
      reloadPlugins: async (pluginIds: string[]) => {
        await this.gateway.plugins.reloadForDevHotReload(
          pluginIds.map((pluginId) => `plugins.entries.${pluginId}.source`),
        );
      },
      startupSettleMs: DEV_PLUGIN_HOT_RELOAD_STARTUP_SETTLE_MS,
    });
  };

  startDeferred = async (): Promise<void> => {
    await this.deferredChannelStarter();
  };

  private start = async (): Promise<void> => {
    await this.gateway.configManager.reloader.getChannels().startAll();
    const enabledChannels = this.gateway.configManager.reloader.getChannels().enabledChannels;
    if (enabledChannels.length > 0) {
      console.log(`✓ Channels enabled: ${enabledChannels.join(", ")}`);
    } else {
      console.log("Warning: No channels enabled");
    }
    this.gateway.bootstrapStatus.markChannelsReady(enabledChannels);
    this.gateway.bootstrapStatus.markReady();
  };
}
