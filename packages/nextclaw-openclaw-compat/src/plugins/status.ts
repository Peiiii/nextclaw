import type { Config } from "@nextclaw/core";
import { getWorkspacePathFromConfig } from "@nextclaw/core";
import type { PluginLogger, PluginRegistry } from "./types.js";
import { loadOpenClawPlugins } from "./loader.js";

export type PluginStatusReport = PluginRegistry & {
  workspaceDir: string;
};

export function buildPluginStatusReport(params: {
  config: Config;
  workspaceDir?: string;
  logger?: PluginLogger;
  reservedToolNames?: string[];
  reservedChannelIds?: string[];
  reservedProviderIds?: string[];
}): PluginStatusReport {
  const workspaceDir = params.workspaceDir?.trim() || getWorkspacePathFromConfig(params.config);
  const registry = loadOpenClawPlugins({
    config: params.config,
    workspaceDir,
    logger: params.logger,
    reservedToolNames: params.reservedToolNames,
    reservedChannelIds: params.reservedChannelIds,
    reservedProviderIds: params.reservedProviderIds
  });

  return {
    workspaceDir,
    ...registry
  };
}
