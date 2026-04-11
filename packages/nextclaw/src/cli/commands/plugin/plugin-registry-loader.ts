import {
  discoverPluginStatusReport,
  loadOpenClawPluginsProgressively,
  type PluginRegistry
} from "@nextclaw/openclaw-compat";
import {
  resolveDevPluginLoadingContext,
} from "./development-source/dev-plugin-overrides.utils.js";
import { resolveDevFirstPartyPluginDir } from "./development-source/first-party-plugin-load-paths.js";
import { buildReservedPluginLoadOptions } from "./plugin-command-utils.js";
import { getAppLogger, type Config } from "@nextclaw/core";

function createPluginLogger() {
  return getAppLogger("plugin.registry_loader");
}

function withDevFirstPartyPluginPaths(config: Config) {
  const workspaceExtensionsDir = resolveDevFirstPartyPluginDir(process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR);
  return resolveDevPluginLoadingContext(config, workspaceExtensionsDir);
}

export async function loadPluginRegistryProgressively(
  config: Config,
  workspaceDir: string,
  options: {
    onPluginProcessed?: (params: { loadedPluginCount: number; pluginId?: string }) => void;
  } = {}
): Promise<PluginRegistry> {
  const { configWithDevPluginOverrides, excludedRoots } = withDevFirstPartyPluginPaths(config);
  return await loadOpenClawPluginsProgressively({
    config: configWithDevPluginOverrides,
    workspaceDir,
    excludeRoots: excludedRoots,
    ...buildReservedPluginLoadOptions(),
    onPluginProcessed: options.onPluginProcessed,
    logger: createPluginLogger()
  });
}

export function discoverPluginRegistryStatus(config: Config, workspaceDir: string) {
  const { configWithDevPluginOverrides } = withDevFirstPartyPluginPaths(config);
  return discoverPluginStatusReport({
    config: configWithDevPluginOverrides,
    workspaceDir
  });
}

export function createEmptyPluginRegistry(): PluginRegistry {
  return {
    plugins: [],
    tools: [],
    channels: [],
    providers: [],
    ncpAgentRuntimes: [],
    diagnostics: [],
    resolvedTools: []
  };
}
