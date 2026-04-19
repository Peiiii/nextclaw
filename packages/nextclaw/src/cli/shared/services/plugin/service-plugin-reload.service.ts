import { getWorkspacePath, type Config } from "@nextclaw/core";
import {
  getPluginChannelBindings,
  startPluginChannelGateways,
  stopPluginChannelGateways,
  type PluginChannelBinding,
  type PluginRegistry,
} from "@nextclaw/openclaw-compat";
import { shouldRestartChannelsForPluginReload } from "@/cli/commands/plugin/plugin-reload.js";
import {
  loadPluginRegistry,
  logPluginDiagnostics,
  toExtensionRegistry,
  type NextclawExtensionRegistry,
} from "@/cli/commands/plugin/index.js";

type PluginGatewayHandles = Awaited<ReturnType<typeof startPluginChannelGateways>>["handles"];
type PluginGatewayDiagnostics = Awaited<ReturnType<typeof startPluginChannelGateways>>["diagnostics"];

export async function reloadServicePlugins(params: {
  nextConfig: Config;
  changedPaths: string[];
  pluginRegistry: PluginRegistry;
  extensionRegistry: NextclawExtensionRegistry;
  pluginChannelBindings: PluginChannelBinding[];
  pluginGatewayHandles: PluginGatewayHandles;
  pluginGatewayLogger: {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    debug: (message: string) => void;
  };
  logPluginGatewayDiagnostics: (diagnostics: PluginGatewayDiagnostics) => void;
}): Promise<{
  pluginRegistry: PluginRegistry;
  extensionRegistry: NextclawExtensionRegistry;
  pluginChannelBindings: PluginChannelBinding[];
  pluginGatewayHandles: PluginGatewayHandles;
  restartChannels: boolean;
}> {
  const nextWorkspace = getWorkspacePath(params.nextConfig.agents.defaults.workspace);
  const nextPluginRegistry = loadPluginRegistry(params.nextConfig, nextWorkspace);
  const nextExtensionRegistry = toExtensionRegistry(nextPluginRegistry);
  const nextPluginChannelBindings = getPluginChannelBindings(nextPluginRegistry);
  const shouldRestartChannels = shouldRestartChannelsForPluginReload({
    changedPaths: params.changedPaths,
    currentPluginChannelBindings: params.pluginChannelBindings,
    nextPluginChannelBindings,
    currentExtensionChannels: params.extensionRegistry.channels,
    nextExtensionChannels: nextExtensionRegistry.channels,
  });
  logPluginDiagnostics(nextPluginRegistry);

  let pluginGatewayHandles = params.pluginGatewayHandles;
  if (shouldRestartChannels) {
    await stopPluginChannelGateways(pluginGatewayHandles);
    const startedPluginGateways = await startPluginChannelGateways({
      registry: nextPluginRegistry,
      config: params.nextConfig,
      logger: params.pluginGatewayLogger,
    });
    pluginGatewayHandles = startedPluginGateways.handles;
    params.logPluginGatewayDiagnostics(startedPluginGateways.diagnostics);
  }

  return {
    pluginRegistry: nextPluginRegistry,
    extensionRegistry: nextExtensionRegistry,
    pluginChannelBindings: nextPluginChannelBindings,
    pluginGatewayHandles,
    restartChannels: shouldRestartChannels,
  };
}
