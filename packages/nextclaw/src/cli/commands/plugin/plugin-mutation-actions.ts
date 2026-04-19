import {
  addPluginLoadPath,
  buildPluginStatusReport,
  disablePluginInConfig,
  enablePluginInConfig,
  installPluginFromNpmSpec,
  installPluginFromPath,
  recordPluginInstall,
  uninstallPlugin,
} from "@nextclaw/openclaw-compat";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { expandHome, getWorkspacePath, loadConfig, saveConfig } from "@nextclaw/core";
import { buildReservedPluginLoadOptions } from "./plugin-command-utils.js";
import type { PluginsInstallOptions, PluginsUninstallOptions } from "../../shared/types/cli.types.js";

export type PluginMutationResult = {
  message: string;
};

export type PluginUninstallMutationResult = PluginMutationResult & {
  warnings: string[];
};

const pluginInstallLogger = {
  info: (message: string) => console.log(message),
  warn: (message: string) => console.warn(message)
};

function resolveFileNpmSpecToLocalPath(
  raw: string,
): { ok: true; path: string } | { ok: false; error: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith("file:")) {
    return null;
  }
  const rest = trimmed.slice("file:".length);
  if (!rest) {
    return { ok: false, error: "unsupported file: spec: missing path" };
  }
  if (rest.startsWith("///")) {
    return { ok: true, path: rest.slice(2) };
  }
  if (rest.startsWith("//localhost/")) {
    return { ok: true, path: rest.slice("//localhost".length) };
  }
  if (rest.startsWith("//")) {
    return {
      ok: false,
      error: 'unsupported file: URL host (expected "file:<path>" or "file:///abs/path")'
    };
  }
  return { ok: true, path: rest };
}

function looksLikePath(raw: string): boolean {
  return (
    raw.startsWith(".") ||
    raw.startsWith("~") ||
    raw.startsWith("/") ||
    raw.endsWith(".ts") ||
    raw.endsWith(".js") ||
    raw.endsWith(".mjs") ||
    raw.endsWith(".cjs") ||
    raw.endsWith(".tgz") ||
    raw.endsWith(".tar.gz") ||
    raw.endsWith(".tar") ||
    raw.endsWith(".zip")
  );
}

function isArchivePath(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return lower.endsWith(".zip") || lower.endsWith(".tgz") || lower.endsWith(".tar.gz") || lower.endsWith(".tar");
}

function saveLinkedPluginInstall(
  config: ReturnType<typeof loadConfig>,
  params: {
    resolvedPath: string;
    pluginId: string;
    version?: string | null;
  },
): PluginMutationResult {
  let next = addPluginLoadPath(config, params.resolvedPath);
  next = enablePluginInConfig(next, params.pluginId);
  next = recordPluginInstall(next, {
    pluginId: params.pluginId,
    source: "path",
    sourcePath: params.resolvedPath,
    installPath: params.resolvedPath,
    version: params.version ?? undefined
  });
  saveConfig(next);
  return {
    message: `Linked plugin path: ${params.resolvedPath}`,
  };
}

function saveInstalledPluginResult(
  config: ReturnType<typeof loadConfig>,
  params: {
    pluginId: string;
    installPath: string;
    version?: string | null;
    source: "archive" | "path" | "npm";
    sourcePath?: string;
    spec?: string;
  },
): PluginMutationResult {
  let next = enablePluginInConfig(config, params.pluginId);
  next = recordPluginInstall(next, {
    pluginId: params.pluginId,
    source: params.source,
    sourcePath: params.sourcePath,
    spec: params.spec,
    installPath: params.installPath,
    version: params.version ?? undefined
  });
  saveConfig(next);
  return {
    message: `Installed plugin: ${params.pluginId}`,
  };
}

async function installPluginFromLocalPath(
  config: ReturnType<typeof loadConfig>,
  resolvedPath: string,
  link: boolean,
): Promise<PluginMutationResult> {
  if (link) {
    const probe = await installPluginFromPath({ path: resolvedPath, dryRun: true });
    if (!probe.ok) {
      throw new Error(probe.error);
    }
    return saveLinkedPluginInstall(config, {
      resolvedPath,
      pluginId: probe.pluginId,
      version: probe.version
    });
  }

  const result = await installPluginFromPath({
    path: resolvedPath,
    logger: pluginInstallLogger
  });
  if (!result.ok) {
    throw new Error(result.error);
  }

  return saveInstalledPluginResult(config, {
    pluginId: result.pluginId,
    source: isArchivePath(resolvedPath) ? "archive" : "path",
    sourcePath: resolvedPath,
    installPath: result.targetDir,
    version: result.version
  });
}

async function installPluginFromRegistrySpec(
  config: ReturnType<typeof loadConfig>,
  spec: string,
): Promise<PluginMutationResult> {
  const result = await installPluginFromNpmSpec({
    spec,
    logger: pluginInstallLogger
  });
  if (!result.ok) {
    throw new Error(result.error);
  }

  return saveInstalledPluginResult(config, {
    pluginId: result.pluginId,
    source: "npm",
    spec,
    installPath: result.targetDir,
    version: result.version
  });
}

export async function enablePluginMutation(id: string): Promise<PluginMutationResult> {
  const config = loadConfig();
  const next = enablePluginInConfig(config, id);
  saveConfig(next);
  return {
    message: `Enabled plugin "${id}".`,
  };
}

export async function disablePluginMutation(id: string): Promise<PluginMutationResult> {
  const config = loadConfig();
  const next = disablePluginInConfig(config, id);
  saveConfig(next);
  return {
    message: `Disabled plugin "${id}".`,
  };
}

export async function uninstallPluginMutation(
  id: string,
  opts: PluginsUninstallOptions = {},
): Promise<PluginUninstallMutationResult> {
  const config = loadConfig();
  const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
  const report = buildPluginStatusReport({
    config,
    workspaceDir,
    ...buildReservedPluginLoadOptions()
  });

  const keepFiles = Boolean(opts.keepFiles || opts.keepConfig);
  const plugin = report.plugins.find((entry) => entry.id === id || entry.name === id);
  const pluginId = plugin?.id ?? id;

  const hasEntry = pluginId in (config.plugins.entries ?? {});
  const hasInstall = pluginId in (config.plugins.installs ?? {});

  if (!hasEntry && !hasInstall) {
    if (plugin) {
      throw new Error(
        `Plugin "${pluginId}" is not managed by plugins config/install records and cannot be uninstalled.`,
      );
    }
    throw new Error(`Plugin not found: ${id}`);
  }

  const result = await uninstallPlugin({
    config,
    pluginId,
    deleteFiles: !keepFiles
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  saveConfig(result.config);

  const removed: string[] = [];
  if (result.actions.entry) {
    removed.push("config entry");
  }
  if (result.actions.install) {
    removed.push("install record");
  }
  if (result.actions.allowlist) {
    removed.push("allowlist");
  }
  if (result.actions.loadPath) {
    removed.push("load path");
  }
  if (result.actions.directory) {
    removed.push("directory");
  }

  return {
    message: `Uninstalled plugin "${pluginId}". Removed: ${removed.length > 0 ? removed.join(", ") : "nothing"}.`,
    warnings: result.warnings,
  };
}

export async function installPluginMutation(
  pathOrSpec: string,
  opts: PluginsInstallOptions = {},
): Promise<PluginMutationResult> {
  const fileSpec = resolveFileNpmSpecToLocalPath(pathOrSpec);
  if (fileSpec && !fileSpec.ok) {
    throw new Error(fileSpec.error);
  }
  const normalized = fileSpec && fileSpec.ok ? fileSpec.path : pathOrSpec;
  const resolved = resolve(expandHome(normalized));
  const config = loadConfig();

  if (existsSync(resolved)) {
    return installPluginFromLocalPath(config, resolved, Boolean(opts.link));
  }

  if (opts.link) {
    throw new Error("`--link` requires a local path.");
  }

  if (looksLikePath(pathOrSpec)) {
    throw new Error(`Path not found: ${resolved}`);
  }

  return installPluginFromRegistrySpec(config, pathOrSpec);
}
