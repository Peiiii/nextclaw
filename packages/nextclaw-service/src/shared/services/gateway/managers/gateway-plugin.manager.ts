import type { Config } from "@nextclaw/core";
import { eventKeys } from "@nextclaw/shared";
import {
  toPluginConfigView,
  type PluginChannelBinding,
  type PluginChannelGatewayHandle,
  type PluginDiagnostic,
} from "@nextclaw/openclaw-compat";
import { logPluginDiagnostics } from "@nextclaw-service/commands/plugin/index.js";
import {
  logPluginGatewayDiagnostics,
  pluginGatewayLogger,
} from "@nextclaw-service/shared/services/gateway/service-startup-support.service.js";
import type { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";

export class GatewayPluginManager {
  private gatewayHandles: PluginChannelGatewayHandle[] = [];

  constructor(private readonly gateway: NextclawGatewayRuntime) {}

  getChannelBindings = (): PluginChannelBinding[] => this.gateway.kernel.extensions.getChannelBindings();

  getUiMetadata = () => this.gateway.kernel.extensions.getUiMetadata();

  load = async (): Promise<void> => {
    const config = this.gateway.configManager.loadConfig();
    let totalPluginCount = 0;
    this.gateway.bootstrapStatus.markChannelsPending();

    try {
      const result = await this.gateway.kernel.extensions.load({
        config,
        onLoadStart: ({ totalPluginCount: nextTotalPluginCount }) => {
          totalPluginCount = nextTotalPluginCount;
          this.gateway.bootstrapStatus.markPluginHydrationRunning({ totalPluginCount: nextTotalPluginCount });
        },
        onPluginProcessed: ({ loadedPluginCount: nextCount }) => {
          this.gateway.bootstrapStatus.markPluginHydrationProgress({
            loadedPluginCount: nextCount,
            totalPluginCount,
          });
        }
      });
      logPluginDiagnostics({ diagnostics: result.diagnostics });

      if (result.shouldRestartChannels) {
        await this.gateway.configManager.rebuildChannels(config, { start: false });
      }
      this.publishConfigChanges();
      this.gateway.bootstrapStatus.markPluginHydrationReady({
        loadedPluginCount: result.loadedPluginCount,
        totalPluginCount,
      });
    } catch (error) {
      this.gateway.bootstrapStatus.markPluginHydrationError(error instanceof Error ? error.message : String(error));
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
    logPluginDiagnostics({ diagnostics: result.diagnostics });
    if (result.shouldRestartChannels) {
      await this.restartGateways();
    }
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

  startGateways = async (): Promise<void> => {
    const config = this.gateway.configManager.loadConfig();
    const diagnostics: PluginDiagnostic[] = [];
    const handles: PluginChannelGatewayHandle[] = [];
    const channelBindings = this.gateway.kernel.extensions.getChannelBindings();
    const configView = toPluginConfigView(config, channelBindings);

    for (const binding of channelBindings) {
      if (!this.isChannelEnabled(binding.channelId, configView)) {
        continue;
      }
      await this.startChannelGateways({
        binding,
        configView,
        diagnostics,
        handles,
      });
    }

    this.gatewayHandles = handles;
    logPluginGatewayDiagnostics(diagnostics);
  };

  publishConfigChanges = (): void => {
    this.gateway.appEventBus.emit(eventKeys.configUpdated, { path: "channels" }, {
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
    this.gateway.appEventBus.emit(eventKeys.configUpdated, { path: "plugins" }, {
      emittedAt: new Date().toISOString(),
      source: "backend",
    });
  };

  restartGateways = async (): Promise<void> => {
    await this.stopGateways();
    await this.startGateways();
  };

  stopGateways = async (): Promise<void> => {
    for (const handle of this.gatewayHandles) {
      try {
        handle.abort?.();
        await handle.stop?.();
      } catch {
        // Ignore stop failures during shutdown.
      }
    }
    this.gatewayHandles = [];
  };

  private startChannelGateways = async (params: {
    binding: PluginChannelBinding;
    configView: Record<string, unknown>;
    diagnostics: PluginDiagnostic[];
    handles: PluginChannelGatewayHandle[];
  }): Promise<void> => {
    const { binding, configView, diagnostics, handles } = params;
    const gateway = binding.channel.gateway;
    if (!gateway?.startAccount) {
      return;
    }
    const accountIds = this.resolveGatewayAccountIds(binding, configView);
    for (const accountId of accountIds) {
      const abortController = new AbortController();
      let stopGateway: (() => void | Promise<void>) | undefined;
      const startTask = Promise.resolve()
        .then(async () =>
          await gateway.startAccount?.({
            accountId,
            channelId: binding.channelId,
            cfg: configView as Config,
            abortSignal: abortController.signal,
            runtime: {
              log: pluginGatewayLogger.info,
              info: pluginGatewayLogger.info,
              warn: pluginGatewayLogger.warn,
              error: pluginGatewayLogger.error,
              debug: pluginGatewayLogger.debug,
            },
            setStatus: () => undefined,
            log: pluginGatewayLogger,
          })
        )
        .then((started) => {
          if (started && typeof started === "object" && "stop" in started && typeof started.stop === "function") {
            stopGateway = started.stop.bind(started);
          }
        })
        .catch((error) => {
          if (abortController.signal.aborted) {
            return;
          }
          this.reportGatewayStartFailure({
            accountId,
            binding,
            diagnostics,
            error,
          });
        });

      handles.push({
        pluginId: binding.pluginId,
        channelId: binding.channelId,
        accountId,
        abort: () => abortController.abort(),
        stop: async () => {
          abortController.abort();
          await startTask;
          await stopGateway?.();
        },
      });
    }
  };

  private resolveGatewayAccountIds = (
    binding: PluginChannelBinding,
    configView: Record<string, unknown>,
  ): string[] => {
    const accountIdsRaw =
      binding.channel.config?.listAccountIds?.(configView) ?? [
        binding.channel.config?.defaultAccountId?.(configView) ?? "default",
      ];
    const accountIds = Array.from(
      new Set(accountIdsRaw.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)),
    );
    return accountIds.length > 0 ? accountIds : ["default"];
  };

  private reportGatewayStartFailure = (params: {
    accountId: string;
    binding: PluginChannelBinding;
    diagnostics: PluginDiagnostic[];
    error: unknown;
  }): void => {
    const { accountId, binding, diagnostics, error } = params;
    const raw = String(error);
    const lower = raw.toLowerCase();
    const level =
      lower.includes("required") || lower.includes("not configured") || lower.includes("missing")
        ? "warn"
        : "error";
    const message = `failed to start channel gateway for ${binding.channelId}/${accountId}: ${raw}`;
    diagnostics.push({
      level,
      pluginId: binding.pluginId,
      message,
    });
    if (level === "error") {
      pluginGatewayLogger.error(message);
      return;
    }
    pluginGatewayLogger.warn(message);
  };

  private isChannelEnabled = (
    channelId: string,
    configView: Record<string, unknown>,
  ): boolean => {
    const channels =
      configView.channels && typeof configView.channels === "object" && !Array.isArray(configView.channels)
        ? (configView.channels as Record<string, unknown>)
        : {};
    const channelConfig = channels[channelId];
    if (!channelConfig || typeof channelConfig !== "object" || Array.isArray(channelConfig)) {
      return false;
    }
    return (channelConfig as { enabled?: unknown }).enabled === true;
  };

}
