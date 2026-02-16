import fs from "node:fs/promises";
import path from "node:path";
import type { Config } from "@nextclaw/core";
import { resolvePluginInstallDir } from "./install.js";

export type UninstallActions = {
  entry: boolean;
  install: boolean;
  allowlist: boolean;
  loadPath: boolean;
  directory: boolean;
};

type PluginInstallRecord = NonNullable<Config["plugins"]["installs"]>[string];

function isLinkedPathInstall(record: PluginInstallRecord | undefined): boolean {
  if (!record || record.source !== "path") {
    return false;
  }
  if (!record.sourcePath || !record.installPath) {
    return true;
  }
  return path.resolve(record.sourcePath) === path.resolve(record.installPath);
}

export type UninstallPluginResult =
  | {
      ok: true;
      config: Config;
      pluginId: string;
      actions: UninstallActions;
      warnings: string[];
    }
  | { ok: false; error: string };

export function resolveUninstallDirectoryTarget(params: {
  pluginId: string;
  hasInstall: boolean;
  installRecord?: PluginInstallRecord;
  extensionsDir?: string;
}): string | null {
  if (!params.hasInstall) {
    return null;
  }

  if (isLinkedPathInstall(params.installRecord)) {
    return null;
  }

  let defaultPath: string;
  try {
    defaultPath = resolvePluginInstallDir(params.pluginId, params.extensionsDir);
  } catch {
    return null;
  }

  const configuredPath = params.installRecord?.installPath;
  if (!configuredPath) {
    return defaultPath;
  }

  if (path.resolve(configuredPath) === path.resolve(defaultPath)) {
    return configuredPath;
  }

  return defaultPath;
}

export function removePluginFromConfig(
  config: Config,
  pluginId: string
): { config: Config; actions: Omit<UninstallActions, "directory"> } {
  const actions: Omit<UninstallActions, "directory"> = {
    entry: false,
    install: false,
    allowlist: false,
    loadPath: false
  };

  const pluginsConfig = config.plugins ?? {};

  let entries = pluginsConfig.entries;
  if (entries && pluginId in entries) {
    const rest = { ...entries };
    delete rest[pluginId];
    entries = Object.keys(rest).length > 0 ? rest : undefined;
    actions.entry = true;
  }

  let installs = pluginsConfig.installs;
  const installRecord = installs?.[pluginId];
  if (installs && pluginId in installs) {
    const rest = { ...installs };
    delete rest[pluginId];
    installs = Object.keys(rest).length > 0 ? rest : undefined;
    actions.install = true;
  }

  let allow = pluginsConfig.allow;
  if (Array.isArray(allow) && allow.includes(pluginId)) {
    allow = allow.filter((id) => id !== pluginId);
    if (allow.length === 0) {
      allow = undefined;
    }
    actions.allowlist = true;
  }

  let load = pluginsConfig.load;
  if (installRecord?.source === "path" && installRecord.sourcePath) {
    const sourcePath = installRecord.sourcePath;
    const loadPaths = load?.paths;
    if (Array.isArray(loadPaths) && loadPaths.includes(sourcePath)) {
      const nextLoadPaths = loadPaths.filter((entry) => entry !== sourcePath);
      load = nextLoadPaths.length > 0 ? { ...load, paths: nextLoadPaths } : undefined;
      actions.loadPath = true;
    }
  }

  const nextPlugins: Config["plugins"] = {
    ...pluginsConfig
  };

  if (entries === undefined) {
    delete (nextPlugins as Record<string, unknown>).entries;
  } else {
    nextPlugins.entries = entries;
  }

  if (installs === undefined) {
    delete (nextPlugins as Record<string, unknown>).installs;
  } else {
    nextPlugins.installs = installs;
  }

  if (allow === undefined) {
    delete (nextPlugins as Record<string, unknown>).allow;
  } else {
    nextPlugins.allow = allow;
  }

  if (load === undefined) {
    delete (nextPlugins as Record<string, unknown>).load;
  } else {
    nextPlugins.load = load;
  }

  return {
    config: {
      ...config,
      plugins: nextPlugins
    },
    actions
  };
}

export async function uninstallPlugin(params: {
  config: Config;
  pluginId: string;
  deleteFiles?: boolean;
  extensionsDir?: string;
}): Promise<UninstallPluginResult> {
  const { config, pluginId, deleteFiles = true, extensionsDir } = params;

  const hasEntry = pluginId in (config.plugins.entries ?? {});
  const hasInstall = pluginId in (config.plugins.installs ?? {});

  if (!hasEntry && !hasInstall) {
    return { ok: false, error: `Plugin not found: ${pluginId}` };
  }

  const installRecord = config.plugins.installs?.[pluginId];
  const isLinked = isLinkedPathInstall(installRecord);

  const { config: nextConfig, actions: configActions } = removePluginFromConfig(config, pluginId);

  const actions: UninstallActions = {
    ...configActions,
    directory: false
  };
  const warnings: string[] = [];

  const deleteTarget =
    deleteFiles && !isLinked
      ? resolveUninstallDirectoryTarget({
          pluginId,
          hasInstall,
          installRecord,
          extensionsDir
        })
      : null;

  if (deleteTarget) {
    const existed =
      (await fs
        .access(deleteTarget)
        .then(() => true)
        .catch(() => false)) ?? false;

    try {
      await fs.rm(deleteTarget, { recursive: true, force: true });
      actions.directory = existed;
    } catch (error) {
      warnings.push(
        `Failed to remove plugin directory ${deleteTarget}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    ok: true,
    config: nextConfig,
    pluginId,
    actions,
    warnings
  };
}
