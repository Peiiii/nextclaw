import {
  buildPluginStatusReport,
  loadOpenClawPlugins,
  resolveUninstallDirectoryTargets,
  type PluginRegistry
} from "@nextclaw/openclaw-compat";
import {
  appendPluginCapabilityLines,
  buildReservedPluginLoadOptions,
} from "./plugin/plugin-command-utils.js";
import {
  resolveDevPluginLoadingContext,
} from "./plugin/development-source/dev-plugin-overrides.utils.js";
import { resolveDevFirstPartyPluginDir } from "./plugin/development-source/first-party-plugin-load-paths.js";
import {
  loadConfig,
  type Config,
  getWorkspacePath
} from "@nextclaw/core";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import type {
  PluginsInfoOptions,
  PluginsInstallOptions,
  PluginsListOptions,
  PluginsUninstallOptions
} from "../types.js";
import {
  disablePluginMutation,
  enablePluginMutation,
  installPluginMutation,
  type PluginMutationResult,
  type PluginUninstallMutationResult,
  uninstallPluginMutation,
} from "./plugin/plugin-mutation-actions.js";
export { type NextclawExtensionRegistry, toExtensionRegistry } from "./plugin/plugin-extension-registry.js";
export { mergePluginConfigView, toPluginConfigView } from "@nextclaw/openclaw-compat";

export function loadPluginRegistry(config: Config, workspaceDir: string): PluginRegistry {
  const workspaceExtensionsDir = resolveDevFirstPartyPluginDir(process.env.NEXTCLAW_DEV_FIRST_PARTY_PLUGIN_DIR);
  const { configWithDevPluginOverrides, excludedRoots } = resolveDevPluginLoadingContext(
    config,
    workspaceExtensionsDir,
  );
  return loadOpenClawPlugins({
    config: configWithDevPluginOverrides,
    workspaceDir,
    excludeRoots: excludedRoots,
    ...buildReservedPluginLoadOptions(),
    logger: {
      info: (message) => console.log(message),
      warn: (message) => console.warn(message),
      error: (message) => console.error(message),
      debug: (message) => console.debug(message)
    }
  });
}

export function logPluginDiagnostics(registry: PluginRegistry): void {
  for (const diag of registry.diagnostics) {
    const prefix = diag.pluginId ? `${diag.pluginId}: ` : "";
    const text = `${prefix}${diag.message}`;
    if (diag.level === "error") {
      console.error(`[plugins] ${text}`);
    } else {
      console.warn(`[plugins] ${text}`);
    }
  }
}

export class PluginCommands {
  constructor() {}

  async enablePlugin(id: string): Promise<PluginMutationResult> {
    return await enablePluginMutation(id);
  }

  async disablePlugin(id: string): Promise<PluginMutationResult> {
    return await disablePluginMutation(id);
  }

  async uninstallPlugin(
    id: string,
    opts: PluginsUninstallOptions = {},
  ): Promise<PluginUninstallMutationResult> {
    return await uninstallPluginMutation(id, opts);
  }

  async installPlugin(
    pathOrSpec: string,
    opts: PluginsInstallOptions = {},
  ): Promise<PluginMutationResult> {
    return await installPluginMutation(pathOrSpec, opts);
  }

  pluginsList(opts: PluginsListOptions = {}): void {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      ...buildReservedPluginLoadOptions()
    });

    const list = opts.enabled ? report.plugins.filter((plugin) => plugin.status === "loaded") : report.plugins;

    if (opts.json) {
      console.log(
        JSON.stringify(
          {
            workspaceDir,
            plugins: list,
            diagnostics: report.diagnostics
          },
          null,
          2
        )
      );
      return;
    }

    if (list.length === 0) {
      console.log("No plugins discovered.");
      return;
    }

    for (const plugin of list) {
      const status = plugin.status === "loaded" ? "loaded" : plugin.status === "disabled" ? "disabled" : "error";
      const title = plugin.name && plugin.name !== plugin.id ? `${plugin.name} (${plugin.id})` : plugin.id;
      if (!opts.verbose) {
        const desc = plugin.description
          ? plugin.description.length > 80
            ? `${plugin.description.slice(0, 77)}...`
            : plugin.description
          : "(no description)";
        console.log(`${title} ${status} - ${desc}`);
        continue;
      }

      console.log(`${title} ${status}`);
      console.log(`  source: ${plugin.source}`);
      console.log(`  origin: ${plugin.origin}`);
      if (plugin.version) {
        console.log(`  version: ${plugin.version}`);
      }
      const capabilityLines: string[] = [];
      appendPluginCapabilityLines(capabilityLines, plugin);
      for (const line of capabilityLines) {
        console.log(`  ${line.toLowerCase()}`);
      }
      if (plugin.error) {
        console.log(`  error: ${plugin.error}`);
      }
      console.log("");
    }
  }

  pluginsInfo(id: string, opts: PluginsInfoOptions = {}): void {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      ...buildReservedPluginLoadOptions()
    });

    const plugin = report.plugins.find((entry) => entry.id === id || entry.name === id);
    if (!plugin) {
      console.error(`Plugin not found: ${id}`);
      process.exit(1);
    }

    if (opts.json) {
      console.log(JSON.stringify(plugin, null, 2));
      return;
    }

    const install = config.plugins.installs?.[plugin.id];
    const lines: string[] = [];
    lines.push(plugin.name || plugin.id);
    if (plugin.name && plugin.name !== plugin.id) {
      lines.push(`id: ${plugin.id}`);
    }
    if (plugin.description) {
      lines.push(plugin.description);
    }
    lines.push("");
    lines.push(`Status: ${plugin.status}`);
    lines.push(`Source: ${plugin.source}`);
    lines.push(`Origin: ${plugin.origin}`);
    if (plugin.version) {
      lines.push(`Version: ${plugin.version}`);
    }
    appendPluginCapabilityLines(lines, plugin);
    if (plugin.error) {
      lines.push(`Error: ${plugin.error}`);
    }

    if (install) {
      lines.push("");
      lines.push(`Install: ${install.source}`);
      if (install.spec) {
        lines.push(`Spec: ${install.spec}`);
      }
      if (install.sourcePath) {
        lines.push(`Source path: ${install.sourcePath}`);
      }
      if (install.installPath) {
        lines.push(`Install path: ${install.installPath}`);
      }
      if (install.version) {
        lines.push(`Recorded version: ${install.version}`);
      }
      if (install.installedAt) {
        lines.push(`Installed at: ${install.installedAt}`);
      }
    }

    console.log(lines.join("\n"));
  }

  async pluginsEnable(id: string): Promise<void> {
    try {
      const result = await this.enablePlugin(id);
      console.log(result.message);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    console.log("If gateway is running, plugin changes are hot-applied automatically.");
  }

  async pluginsDisable(id: string): Promise<void> {
    try {
      const result = await this.disablePlugin(id);
      console.log(result.message);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    console.log("If gateway is running, plugin changes are hot-applied automatically.");
  }

  async pluginsUninstall(id: string, opts: PluginsUninstallOptions = {}): Promise<void> {
    if (opts.keepConfig) {
      console.log("`--keep-config` is deprecated, use `--keep-files`.");
    }

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
        console.error(
          `Plugin "${pluginId}" is not managed by plugins config/install records and cannot be uninstalled.`
        );
      } else {
        console.error(`Plugin not found: ${id}`);
      }
      process.exit(1);
    }

    const install = config.plugins.installs?.[pluginId];
    const isLinked =
      install?.source === "path" &&
      (!install.installPath || !install.sourcePath || resolve(install.installPath) === resolve(install.sourcePath));

    const preview: string[] = [];
    if (hasEntry) {
      preview.push("config entry");
    }
    if (hasInstall) {
      preview.push("install record");
    }
    if (config.plugins.allow?.includes(pluginId)) {
      preview.push("allowlist entry");
    }
    if (isLinked && install?.sourcePath && config.plugins.load?.paths?.includes(install.sourcePath)) {
      preview.push("load path");
    }

    const deleteTargets = !keepFiles
      ? resolveUninstallDirectoryTargets({
          config,
          pluginId,
          hasInstall,
          installRecord: install
        })
      : [];

    for (const deleteTarget of deleteTargets) {
      preview.push(`directory: ${deleteTarget}`);
    }

    const pluginName = plugin?.name || pluginId;
    const pluginTitle = pluginName !== pluginId ? `${pluginName} (${pluginId})` : pluginName;
    console.log(`Plugin: ${pluginTitle}`);
    console.log(`Will remove: ${preview.length > 0 ? preview.join(", ") : "(nothing)"}`);

    if (opts.dryRun) {
      console.log("Dry run, no changes made.");
      return;
    }

    if (!opts.force) {
      const confirmed = await this.confirmYesNo(`Uninstall plugin "${pluginId}"?`);
      if (!confirmed) {
        console.log("Cancelled.");
        return;
      }
    }

    try {
      const result = await this.uninstallPlugin(id, opts);
      for (const warning of result.warnings) {
        console.warn(warning);
      }
      console.log(result.message);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    console.log("If gateway is running, plugin changes are hot-applied automatically.");
  }

  async pluginsInstall(pathOrSpec: string, opts: PluginsInstallOptions = {}): Promise<void> {
    try {
      const result = await this.installPlugin(pathOrSpec, opts);
      console.log(result.message);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    console.log("If gateway is running, plugin changes are hot-applied automatically.");
  }

  pluginsDoctor(): void {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      ...buildReservedPluginLoadOptions()
    });

    const pluginErrors = report.plugins.filter((plugin) => plugin.status === "error");
    const diagnostics = report.diagnostics.filter((diag) => diag.level === "error");

    if (pluginErrors.length === 0 && diagnostics.length === 0) {
      console.log("No plugin issues detected.");
      return;
    }

    if (pluginErrors.length > 0) {
      console.log("Plugin errors:");
      for (const entry of pluginErrors) {
        console.log(`- ${entry.id}: ${entry.error ?? "failed to load"} (${entry.source})`);
      }
    }

    if (diagnostics.length > 0) {
      if (pluginErrors.length > 0) {
        console.log("");
      }
      console.log("Diagnostics:");
      for (const diag of diagnostics) {
        const prefix = diag.pluginId ? `${diag.pluginId}: ` : "";
        console.log(`- ${prefix}${diag.message}`);
      }
    }
  }

  private async confirmYesNo(question: string): Promise<boolean> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question(`${question} [y/N] `, (line) => resolve(line));
    });

    rl.close();
    const normalized = answer.trim().toLowerCase();
    return normalized === "y" || normalized === "yes";
  }

}
