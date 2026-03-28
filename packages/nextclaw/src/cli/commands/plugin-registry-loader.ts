import {
  discoverPluginStatusReport,
  loadOpenClawPluginsProgressively,
  type PluginRegistry
} from "@nextclaw/openclaw-compat";
import {
  applyDevFirstPartyPluginLoadPaths,
  resolveDevFirstPartyPluginDir,
  resolveDevFirstPartyPluginInstallRoots,
} from "./dev-first-party-plugin-load-paths.js";
import { buildReservedPluginLoadOptions } from "./plugin-command-utils.js";
import type { Config } from "@nextclaw/core";

function createPluginLogger() {
  return {
    info: (message: string) => console.log(message),
    warn: (message: string) => console.warn(message),
    error: (message: string) => console.error(message),
    debug: (message: string) => console.debug(message)
  };
}

function withDevFirstPartyPluginPaths(config: Config) {
  const workspaceExtensionsDir = resolveDevFirstPartyPluginDir(process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR);
  return {
    workspaceExtensionsDir,
    configWithDevPluginPaths: applyDevFirstPartyPluginLoadPaths(config, workspaceExtensionsDir)
  };
}

export async function loadPluginRegistryProgressively(
  config: Config,
  workspaceDir: string,
  options: {
    onPluginProcessed?: (params: { loadedPluginCount: number; pluginId?: string }) => void;
  } = {}
): Promise<PluginRegistry> {
  const { workspaceExtensionsDir, configWithDevPluginPaths } = withDevFirstPartyPluginPaths(config);
  const excludedRoots = resolveDevFirstPartyPluginInstallRoots(config, workspaceExtensionsDir);
  return await loadOpenClawPluginsProgressively({
    config: configWithDevPluginPaths,
    workspaceDir,
    excludeRoots: excludedRoots,
    ...buildReservedPluginLoadOptions(),
    onPluginProcessed: options.onPluginProcessed,
    logger: createPluginLogger()
  });
}

export function discoverPluginRegistryStatus(config: Config, workspaceDir: string) {
  const { configWithDevPluginPaths } = withDevFirstPartyPluginPaths(config);
  return discoverPluginStatusReport({
    config: configWithDevPluginPaths,
    workspaceDir
  });
}

export function createEmptyPluginRegistry(): PluginRegistry {
  return {
    plugins: [],
    tools: [],
    channels: [],
    providers: [],
    engines: [],
    ncpAgentRuntimes: [],
    diagnostics: [],
    resolvedTools: []
  };
}
