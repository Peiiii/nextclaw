import { getWorkspacePath, loadConfig, resolveConfigSecrets, type Config } from "@nextclaw/core";
import {
  getPluginChannelBindings,
  getPluginUiMetadataFromRegistry,
  type PluginChannelBinding,
  type PluginRegistry,
  type PluginUiMetadata,
} from "@nextclaw/openclaw-compat";
import type { UiNcpAgentHandle } from "../../../ncp/features/runtime/create-ui-ncp-agent.service.js";
import { applyGatewayCapabilityState, type GatewayStartupContext } from "./service-gateway-context.service.js";
import { shouldRestartChannelsForPluginReload } from "../../../plugin/plugin-reload.js";
import {
  logPluginDiagnostics,
  toExtensionRegistry,
  type NextclawExtensionRegistry,
} from "../../../plugin/index.js";
import { discoverPluginRegistryStatus, loadPluginRegistryProgressively } from "../../../plugin/plugin-registry-loader.js";
import type { ServiceBootstrapStatusStore } from "./service-bootstrap-status.js";
import { waitForUiShellGraceWindow } from "./service-ui-shell-grace.js";
import type { UiStartupHandle } from "./service-gateway-startup.service.js";

export type ServiceCapabilityHydrationState = {
  pluginRegistry: PluginRegistry;
  extensionRegistry: NextclawExtensionRegistry;
  pluginChannelBindings: PluginChannelBinding[];
  pluginUiMetadata: PluginUiMetadata[];
};

function countEnabledPlugins(config: Config, workspaceDir: string): number {
  return discoverPluginRegistryStatus(config, workspaceDir).plugins.filter((plugin) => plugin.enabled).length;
}

export async function hydrateServiceCapabilities(params: {
  uiStartup: UiStartupHandle | null;
  gateway: GatewayStartupContext;
  state: ServiceCapabilityHydrationState;
  bootstrapStatus: ServiceBootstrapStatusStore;
  getLiveUiNcpAgent: () => UiNcpAgentHandle | null;
}): Promise<void> {
  await waitForUiShellGraceWindow(params.uiStartup);
  const nextConfig = resolveConfigSecrets(loadConfig(), { configPath: params.gateway.runtimeConfigPath });
  const nextWorkspace = getWorkspacePath(nextConfig.agents.defaults.workspace);
  const totalPluginCount = countEnabledPlugins(nextConfig, nextWorkspace);
  let loadedPluginCount = 0;

  params.bootstrapStatus.markPluginHydrationRunning({
    totalPluginCount
  });
  params.bootstrapStatus.markChannelsPending();

  try {
    const nextPluginRegistry = await loadPluginRegistryProgressively(nextConfig, nextWorkspace, {
      onPluginProcessed: ({ loadedPluginCount: nextCount }) => {
        loadedPluginCount = nextCount;
        params.bootstrapStatus.markPluginHydrationProgress({
          loadedPluginCount: nextCount,
          totalPluginCount
        });
      }
    });
    logPluginDiagnostics(nextPluginRegistry);

    const nextExtensionRegistry = toExtensionRegistry(nextPluginRegistry);
    const nextPluginChannelBindings = getPluginChannelBindings(nextPluginRegistry);
    const nextPluginUiMetadata = getPluginUiMetadataFromRegistry(nextPluginRegistry);
    const shouldRebuildChannels = shouldRestartChannelsForPluginReload({
      changedPaths: [],
      currentPluginChannelBindings: params.state.pluginChannelBindings,
      nextPluginChannelBindings,
      currentExtensionChannels: params.state.extensionRegistry.channels,
      nextExtensionChannels: nextExtensionRegistry.channels,
    });

    applyGatewayCapabilityState(params.gateway, {
      pluginRegistry: nextPluginRegistry,
      extensionRegistry: nextExtensionRegistry,
      pluginChannelBindings: nextPluginChannelBindings,
    });
    params.state.pluginRegistry = nextPluginRegistry;
    params.state.extensionRegistry = nextExtensionRegistry;
    params.state.pluginChannelBindings = nextPluginChannelBindings;
    params.state.pluginUiMetadata = nextPluginUiMetadata;

    params.getLiveUiNcpAgent()?.applyExtensionRegistry?.(nextExtensionRegistry);

    if (shouldRebuildChannels) {
      await params.gateway.reloader.rebuildChannels(nextConfig, { start: false });
    }

    params.uiStartup?.publish({ type: "config.updated", payload: { path: "channels" } });
    params.uiStartup?.publish({ type: "config.updated", payload: { path: "plugins" } });
    params.bootstrapStatus.markPluginHydrationReady({
      loadedPluginCount: loadedPluginCount || totalPluginCount,
      totalPluginCount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    params.bootstrapStatus.markPluginHydrationError(message);
    throw error;
  }
}
