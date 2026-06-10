import type { Config, ExtensionChannelBinding, ExtensionUiMetadata } from "@nextclaw/core";
import { eventKeys } from "@nextclaw/shared";
import type { ServiceGatewayManager } from "@nextclaw-service/managers/service-gateway.manager.js";

export class GatewayExtensionManager {
  constructor(private readonly gateway: ServiceGatewayManager) {}

  getChannelBindings = (): ExtensionChannelBinding[] => this.gateway.kernel.extensions.getChannelBindings();

  getUiMetadata = (): ExtensionUiMetadata[] => this.gateway.kernel.extensions.getUiMetadata();

  authenticateEventStreamCredential = (input: {
    extensionId: string | null;
    token: string | null;
  }): { extensionId: string } | null =>
    this.gateway.kernel.extensions.authenticateEventStreamCredential(input);

  load = async (): Promise<void> => {
    const config = this.gateway.configManager.loadConfig();
    this.gateway.bootstrapStatus.markChannelsPending();

    try {
      const result = await this.gateway.kernel.extensions.load({
        config,
        onLoadStart: ({ totalExtensionCount }) => {
          this.gateway.bootstrapStatus.markExtensionLoadingRunning({ totalExtensionCount });
        },
        onExtensionProcessed: ({ loadedExtensionCount, totalExtensionCount }) => {
          this.gateway.bootstrapStatus.markExtensionLoadingProgress({
            loadedExtensionCount,
            totalExtensionCount,
          });
        },
      });
      this.logDiagnostics(result.diagnostics);

      if (result.shouldRestartChannels) {
        await this.gateway.configManager.rebuildChannels(config, { start: false });
      }
      this.publishConfigChanges();
      this.gateway.bootstrapStatus.markExtensionLoadingReady({
        loadedExtensionCount: result.loadedExtensionCount,
        totalExtensionCount: result.totalExtensionCount,
      });
    } catch (error) {
      this.gateway.bootstrapStatus.markExtensionLoadingError(error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  reloadForConfigChange = async (params: {
    config: Config;
    changedPaths: string[];
  }): Promise<{ restartChannels: boolean }> => {
    const result = await this.gateway.kernel.extensions.reloadForConfigChange({
      config: params.config,
      changedPaths: params.changedPaths,
    });
    this.logDiagnostics(result.diagnostics);
    this.publishConfigChanges();
    return { restartChannels: result.shouldRestartChannels };
  };

  reloadForDevHotReload = async (changedPaths: string[]): Promise<void> => {
    const config = this.gateway.configManager.loadConfig();
    const result = await this.reloadForConfigChange({
      config,
      changedPaths,
    });
    if (result.restartChannels) {
      await this.gateway.configManager.rebuildChannels(config, { start: true });
    }
  };

  publishConfigChanges = (): void => {
    this.gateway.appEventBus.emit(eventKeys.configUpdated, { path: "channels" }, {
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
    this.gateway.appEventBus.emit(eventKeys.configUpdated, { path: "extensions" }, {
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
  };

  private logDiagnostics = (
    diagnostics: Array<{ level: "warn" | "error"; message: string; extensionId?: string; source?: string }>,
  ): void => {
    for (const diagnostic of diagnostics) {
      const prefix = diagnostic.extensionId ? `${diagnostic.extensionId}: ` : "";
      const message = `${prefix}${diagnostic.message}`;
      if (diagnostic.level === "error") {
        console.error(`[extensions] ${message}`);
        continue;
      }
      console.warn(`[extensions] ${message}`);
    }
  };
}
