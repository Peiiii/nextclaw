import { getWorkspacePath, loadConfig, resolveConfigSecrets, type Config } from "@nextclaw/core";
import {
  getPluginChannelBindings,
  getPluginUiMetadataFromRegistry,
  type PluginChannelBinding,
  type PluginRegistry,
  type PluginUiMetadata,
} from "@nextclaw/openclaw-compat";
import type { UiNcpAgentHandle } from "@/cli/commands/ncp/features/runtime/create-ui-ncp-agent.service.js";
import { applyGatewayCapabilityState, type GatewayStartupContext } from "@/cli/shared/services/gateway/service-gateway-context.service.js";
import { shouldRestartChannelsForPluginReload } from "@/cli/commands/plugin/plugin-reload.js";
import {
  logPluginDiagnostics,
  toExtensionRegistry,
  type NextclawExtensionRegistry,
} from "@/cli/commands/plugin/index.js";
import { discoverPluginRegistryStatus } from "@/cli/commands/plugin/plugin-registry-loader.js";
import type { ExtensionHostClient } from "@/cli/shared/services/extension-host-client.service.js";
import type { ServiceBootstrapStatusStore } from "@/cli/shared/services/gateway/service-bootstrap-status.js";
import { waitForUiShellGraceWindow } from "@/cli/shared/services/gateway/service-ui-shell-grace.js";
import type { UiStartupHandle } from "@/cli/shared/services/gateway/service-gateway-startup.service.js";

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
  extensionHost: ExtensionHostClient;
}): Promise<void> {
  const {
    bootstrapStatus,
    extensionHost,
    gateway,
    getLiveUiNcpAgent,
    state,
    uiStartup,
  } = params;
  await waitForUiShellGraceWindow(uiStartup);
  const nextConfig = resolveConfigSecrets(loadConfig(), { configPath: gateway.runtimeConfigPath });
  const nextWorkspace = getWorkspacePath(nextConfig.agents.defaults.workspace);
  const totalPluginCount = countEnabledPlugins(nextConfig, nextWorkspace);
  let loadedPluginCount = 0;

  bootstrapStatus.markPluginHydrationRunning({
    totalPluginCount
  });
  bootstrapStatus.markChannelsPending();

  try {
    const nextPluginRegistry = extensionHost.createProxyPluginRegistry(
      await extensionHost.load({
        config: nextConfig,
        workspaceDir: nextWorkspace,
      }),
    );
    loadedPluginCount = loadedPluginCount || nextPluginRegistry.plugins.filter((plugin) => plugin.status === "loaded").length;
    logPluginDiagnostics(nextPluginRegistry);

    const nextExtensionRegistry = toExtensionRegistry(nextPluginRegistry);
    const nextPluginChannelBindings = getPluginChannelBindings(nextPluginRegistry);
    const nextPluginUiMetadata = getPluginUiMetadataFromRegistry(nextPluginRegistry);
    const shouldRebuildChannels = shouldRestartChannelsForPluginReload({
      changedPaths: [],
      currentPluginChannelBindings: state.pluginChannelBindings,
      nextPluginChannelBindings,
      currentExtensionChannels: state.extensionRegistry.channels,
      nextExtensionChannels: nextExtensionRegistry.channels,
    });

    applyGatewayCapabilityState(gateway, {
      pluginRegistry: nextPluginRegistry,
      extensionRegistry: nextExtensionRegistry,
      pluginChannelBindings: nextPluginChannelBindings,
    });
    state.pluginRegistry = nextPluginRegistry;
    state.extensionRegistry = nextExtensionRegistry;
    state.pluginChannelBindings = nextPluginChannelBindings;
    state.pluginUiMetadata = nextPluginUiMetadata;

    getLiveUiNcpAgent()?.applyExtensionRegistry?.(nextExtensionRegistry);

    if (shouldRebuildChannels) {
      await gateway.reloader.rebuildChannels(nextConfig, { start: false });
    }

    uiStartup?.publish({ type: "config.updated", payload: { path: "channels" } });
    uiStartup?.publish({ type: "config.updated", payload: { path: "plugins" } });
    bootstrapStatus.markPluginHydrationReady({
      loadedPluginCount: loadedPluginCount || totalPluginCount,
      totalPluginCount
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    bootstrapStatus.markPluginHydrationError(message);
    throw error;
  }
}
