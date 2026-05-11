import {
  getWorkspacePath,
  type Config,
} from "@nextclaw/core";
import { eventKeys } from "@nextclaw/kernel";
import {
  getPluginChannelBindings,
  getPluginUiMetadataFromRegistry,
  toPluginConfigView,
  type PluginChannelBinding,
  type PluginChannelGatewayHandle,
  type PluginDiagnostic,
  type PluginRegistry,
  type PluginUiMetadata,
} from "@nextclaw/openclaw-compat";
import {
  createEmptyPluginRegistry,
  logPluginDiagnostics,
  toExtensionRegistry,
  type NextclawExtensionRegistry,
} from "@nextclaw-service/commands/plugin/index.js";
import { shouldRestartChannelsForPluginReload } from "@nextclaw-service/commands/plugin/plugin-reload.js";
import {
  discoverPluginRegistryStatus,
  loadPluginRegistryProgressively,
} from "@nextclaw-service/commands/plugin/plugin-registry-loader.js";
import {
  logPluginGatewayDiagnostics,
  pluginGatewayLogger,
} from "@nextclaw-service/shared/services/gateway/service-startup-support.service.js";
import type { NextclawGatewayRuntime } from "@nextclaw-service/shared/services/gateway/nextclaw-gateway-runtime.service.js";

type PluginSnapshot = {
  registry: PluginRegistry;
  extensionRegistry: NextclawExtensionRegistry;
  channelBindings: PluginChannelBinding[];
  uiMetadata: PluginUiMetadata[];
};

type ExtensionContributions = {
  channelBindings: PluginChannelBinding[];
  uiMetadata: PluginUiMetadata[];
};

function buildSnapshot(
  registry: PluginRegistry,
  extensionContributions: ExtensionContributions,
): PluginSnapshot {
  const extensionChannelIds = new Set(extensionContributions.channelBindings.map((binding) => binding.channelId));
  const extensionPluginIds = new Set(extensionContributions.uiMetadata.map((metadata) => metadata.id));
  return {
    registry,
    extensionRegistry: toExtensionRegistry(registry),
    channelBindings: [
      ...getPluginChannelBindings(registry).filter((binding) => !extensionChannelIds.has(binding.channelId)),
      ...extensionContributions.channelBindings,
    ],
    uiMetadata: [
      ...getPluginUiMetadataFromRegistry(registry).filter((metadata) => !extensionPluginIds.has(metadata.id)),
      ...extensionContributions.uiMetadata,
    ],
  };
}

function countEnabledPlugins(config: Config, workspaceDir: string): number {
  return discoverPluginRegistryStatus(config, workspaceDir).plugins.filter((plugin) => plugin.enabled).length;
}

export class GatewayPluginManager {
  private extensionContributions: ExtensionContributions = {
    channelBindings: [],
    uiMetadata: [],
  };
  private snapshot: PluginSnapshot = buildSnapshot(createEmptyPluginRegistry(), this.extensionContributions);
  private gatewayHandles: PluginChannelGatewayHandle[] = [];

  constructor(private readonly gateway: NextclawGatewayRuntime) {}

  getRegistry = (): PluginRegistry => this.snapshot.registry;

  getExtensionRegistry = (): NextclawExtensionRegistry => this.snapshot.extensionRegistry;

  getChannelBindings = (): PluginChannelBinding[] => this.snapshot.channelBindings;

  getUiMetadata = (): PluginUiMetadata[] => this.snapshot.uiMetadata;

  load = async (): Promise<void> => {
    const config = this.gateway.configManager.loadConfig();
    const workspace = getWorkspacePath(config.agents.defaults.workspace);
    const totalPluginCount = countEnabledPlugins(config, workspace);
    let loadedPluginCount = 0;

    this.gateway.bootstrapStatus.markPluginHydrationRunning({ totalPluginCount });
    this.gateway.bootstrapStatus.markChannelsPending();

    try {
      const registry = await loadPluginRegistryProgressively(config, workspace, {
        onPluginProcessed: ({ loadedPluginCount: nextCount }) => {
          loadedPluginCount = nextCount;
          this.gateway.bootstrapStatus.markPluginHydrationProgress({
            loadedPluginCount: nextCount,
            totalPluginCount,
          });
        },
      });
      this.extensionContributions = await this.gateway.extensions.loadContributions();
      const shouldRebuildChannels = this.replaceSnapshot(registry, []);
      logPluginDiagnostics(registry);

      this.gateway.liveUiNcpAgent?.applyExtensionRegistry?.(this.snapshot.extensionRegistry);
      if (shouldRebuildChannels) {
        await this.gateway.configManager.rebuildChannels(config, { start: false });
      }
      this.publishConfigChanges();
      this.gateway.bootstrapStatus.markPluginHydrationReady({
        loadedPluginCount: loadedPluginCount || totalPluginCount,
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
    const workspace = getWorkspacePath(params.config.agents.defaults.workspace);
    const registry = await loadPluginRegistryProgressively(params.config, workspace);
    this.extensionContributions = await this.gateway.extensions.loadContributions();
    const restartChannels = this.replaceSnapshot(registry, params.changedPaths);
    logPluginDiagnostics(registry);
    if (restartChannels) {
      await this.restartGateways();
    }
    this.gateway.liveUiNcpAgent?.applyExtensionRegistry?.(this.snapshot.extensionRegistry);
    this.publishConfigChanges();
    return { restartChannels };
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
    const configView = toPluginConfigView(config, this.snapshot.channelBindings);

    for (const binding of this.snapshot.channelBindings) {
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

  private replaceSnapshot = (
    registry: PluginRegistry,
    changedPaths: string[],
  ): boolean => {
    const nextSnapshot = buildSnapshot(registry, this.extensionContributions);
    const shouldRestartChannels = shouldRestartChannelsForPluginReload({
      changedPaths,
      currentPluginChannelBindings: this.snapshot.channelBindings,
      nextPluginChannelBindings: nextSnapshot.channelBindings,
      currentExtensionChannels: this.snapshot.extensionRegistry.channels,
      nextExtensionChannels: nextSnapshot.extensionRegistry.channels,
    });
    this.snapshot = nextSnapshot;
    return shouldRestartChannels;
  };
}
