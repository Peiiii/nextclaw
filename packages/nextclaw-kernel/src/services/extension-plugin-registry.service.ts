import { getAppLogger, type Config } from "@nextclaw/core";
import {
  discoverPluginStatusReport,
  loadOpenClawPlugins,
  loadOpenClawPluginsProgressively,
  type PluginRegistry,
} from "@nextclaw/openclaw-compat";
import { builtinProviderIds } from "@nextclaw/runtime";
import {
  resolveDevPluginLoadingContext,
  resolveDevFirstPartyPluginDir,
} from "@kernel/features/extension-development-source/index.js";

export type ExtensionPluginLoadProgress = { loadedPluginCount: number; pluginId?: string };

const RESERVED_TOOL_NAMES = [
  "read_file",
  "write_file",
  "edit_file",
  "list_dir",
  "exec",
  "web_search",
  "web_fetch",
  "message",
  "spawn",
  "sessions_list",
  "sessions_history",
  "memory_search",
  "memory_get",
  "subagents",
  "gateway",
  "cron",
] as const;

function buildReservedPluginLoadOptions() {
  return {
    reservedToolNames: [...RESERVED_TOOL_NAMES],
    reservedChannelIds: [] as string[],
    reservedProviderIds: builtinProviderIds(),
  };
}

function createPluginLogger() {
  return getAppLogger("extension.manager.plugin_registry");
}

export class ExtensionPluginRegistryService {
  discoverEnabledPluginCount = (params: {
    config: Config;
    workspace: string;
  }): number => {
    const { configWithDevPluginOverrides } = this.resolveLoadingContext(params.config);
    return discoverPluginStatusReport({
      config: configWithDevPluginOverrides,
      workspaceDir: params.workspace,
    }).plugins.filter((plugin) => plugin.enabled).length;
  };

  load = (params: {
    config: Config;
    workspace: string;
  }): PluginRegistry => {
    const { configWithDevPluginOverrides, excludedRoots } = this.resolveLoadingContext(params.config);
    return loadOpenClawPlugins({
      config: configWithDevPluginOverrides,
      workspaceDir: params.workspace,
      excludeRoots: excludedRoots,
      ...buildReservedPluginLoadOptions(),
      logger: createPluginLogger(),
    });
  };

  loadProgressively = async (params: {
    config: Config;
    workspace: string;
    onPluginProcessed?: (params: ExtensionPluginLoadProgress) => void;
  }): Promise<PluginRegistry> => {
    const { configWithDevPluginOverrides, excludedRoots } = this.resolveLoadingContext(params.config);
    return await loadOpenClawPluginsProgressively({
      config: configWithDevPluginOverrides,
      workspaceDir: params.workspace,
      excludeRoots: excludedRoots,
      ...buildReservedPluginLoadOptions(),
      onPluginProcessed: params.onPluginProcessed,
      logger: createPluginLogger(),
    });
  };

  private resolveLoadingContext = (config: Config) => {
    const workspaceExtensionsDir = resolveDevFirstPartyPluginDir(
      process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR,
    );
    return resolveDevPluginLoadingContext(config, workspaceExtensionsDir);
  };
}
