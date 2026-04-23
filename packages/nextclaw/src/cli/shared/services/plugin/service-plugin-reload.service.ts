import { getWorkspacePath, type Config } from "@nextclaw/core";
import {
  getPluginChannelBindings,
  type PluginChannelBinding,
  type PluginRegistry,
} from "@nextclaw/openclaw-compat";
import { shouldRestartChannelsForPluginReload } from "@/cli/commands/plugin/plugin-reload.js";
import {
  logPluginDiagnostics,
  toExtensionRegistry,
  type NextclawExtensionRegistry,
} from "@/cli/commands/plugin/index.js";
import type { ExtensionHostClient } from "@/cli/shared/services/extension-host-client.service.js";

export async function reloadServicePlugins(params: {
  nextConfig: Config;
  changedPaths: string[];
  extensionRegistry: NextclawExtensionRegistry;
  pluginChannelBindings: PluginChannelBinding[];
  extensionHost: ExtensionHostClient;
}): Promise<{
  pluginRegistry: PluginRegistry;
  extensionRegistry: NextclawExtensionRegistry;
  pluginChannelBindings: PluginChannelBinding[];
  restartChannels: boolean;
}> {
  const nextWorkspace = getWorkspacePath(params.nextConfig.agents.defaults.workspace);
  const nextPluginRegistry = params.extensionHost.createProxyPluginRegistry(
    await params.extensionHost.load({
      config: params.nextConfig,
      workspaceDir: nextWorkspace,
    }),
  );
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

  if (shouldRestartChannels) {
    await params.extensionHost.stopPluginGateways();
    await params.extensionHost.startPluginGateways(params.nextConfig);
  }

  return {
    pluginRegistry: nextPluginRegistry,
    extensionRegistry: nextExtensionRegistry,
    pluginChannelBindings: nextPluginChannelBindings,
    restartChannels: shouldRestartChannels,
  };
}
