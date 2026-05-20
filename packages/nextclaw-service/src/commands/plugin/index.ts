import {
  buildPluginStatusReport,
  resolveUninstallDirectoryTargets,
  type PluginRegistry
} from "@nextclaw/openclaw-compat";
import {
  appendPluginCapabilityLines,
  buildReservedPluginLoadOptions,
} from "./plugin-command.utils.js";
import { ExtensionPluginRegistryService } from "@nextclaw/kernel";
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
} from "../../shared/types/cli.types.js";
import {
  disablePluginMutation,
  enablePluginMutation,
  installPluginMutation,
  uninstallPluginMutation,
} from "./plugin-mutation-actions.utils.js";
export { mergePluginConfigView, toPluginConfigView } from "@nextclaw/openclaw-compat";

type PluginStatusReport = ReturnType<typeof buildPluginStatusReport>;
type PluginStatusEntry = PluginStatusReport["plugins"][number];
type PluginInstallRecord = NonNullable<Config["plugins"]["installs"]>[string];

export function loadPluginRegistry(config: Config, workspaceDir: string): PluginRegistry {
  return new ExtensionPluginRegistryService().load({
    config,
    workspace: workspaceDir,
  });
}

export function logPluginDiagnostics(registry: Pick<PluginRegistry, "diagnostics">): void {
  for (const diag of registry.diagnostics) {
    const prefix = diag.pluginId ? `${diag.pluginId}: ` : "";
    const text = `${prefix}${diag.message}`;
    if (diag.level === "error") {
      console.error(`[plugins] ${text}`);
    } else {
      console.warn(`[plugins] ${text}`);
    }
  };
}

export class PluginCommands {
  list = (opts: PluginsListOptions = {}): void => {
    const { report, workspaceDir } = this.loadStatusReport();

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
  };

  info = (id: string, opts: PluginsInfoOptions = {}): void => {
    const { config, report } = this.loadStatusReport();
    const plugin = report.plugins.find((entry) => entry.id === id || entry.name === id);
    if (!plugin) {
      console.error(`Plugin not found: ${id}`);
      process.exit(1);
    }

    if (opts.json) {
      console.log(JSON.stringify(plugin, null, 2));
      return;
    }

    console.log(this.buildPluginInfoLines(plugin, config).join("\n"));
  };

  enable = async (id: string): Promise<void> => {
    try {
      const result = await enablePluginMutation(id);
      console.log(result.message);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    console.log("If gateway is running, plugin changes are hot-applied automatically.");
  };

  disable = async (id: string): Promise<void> => {
    try {
      const result = await disablePluginMutation(id);
      console.log(result.message);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    console.log("If gateway is running, plugin changes are hot-applied automatically.");
  };

  uninstall = async (id: string, opts: PluginsUninstallOptions = {}): Promise<void> => {
    if (opts.keepConfig) {
      console.log("`--keep-config` is deprecated, use `--keep-files`.");
    }

    const { config, report } = this.loadStatusReport();

    const keepFiles = Boolean(opts.keepFiles || opts.keepConfig);
    const plugin = report.plugins.find((entry) => entry.id === id || entry.name === id);
    const pluginId = plugin?.id ?? id;

    const hasEntry = pluginId in (config.plugins.entries ?? {});
    const hasInstall = pluginId in (config.plugins.installs ?? {});

    this.assertPluginCanUninstall(id, pluginId, plugin, hasEntry, hasInstall);

    const install = config.plugins.installs?.[pluginId];
    const preview = this.buildUninstallPreview({ config, hasEntry, hasInstall, install, keepFiles, pluginId });

    const pluginName = plugin?.name || pluginId;
    const pluginTitle = pluginName !== pluginId ? `${pluginName} (${pluginId})` : pluginName;
    console.log(`Plugin: ${pluginTitle}`);
    console.log(`Will remove: ${preview.length > 0 ? preview.join(", ") : "(nothing)"}`);

    if (opts.dryRun) {
      console.log("Dry run, no changes made.");
      return;
    }

    if (!(await this.confirmUninstall(pluginId, opts))) {
      return;
    }
    await this.runUninstallMutation(id, opts);
    console.log("If gateway is running, plugin changes are hot-applied automatically.");
  };

  install = async (pathOrSpec: string, opts: PluginsInstallOptions = {}): Promise<void> => {
    try {
      const result = await installPluginMutation(pathOrSpec, opts);
      console.log(result.message);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
    console.log("If gateway is running, plugin changes are hot-applied automatically.");
  };

  doctor = (): void => {
    const { report } = this.loadStatusReport();

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
  };

  private confirmYesNo = async (question: string): Promise<boolean> => {
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
  };

  private confirmUninstall = async (pluginId: string, opts: PluginsUninstallOptions): Promise<boolean> => {
    if (opts.force) {
      return true;
    }
    const confirmed = await this.confirmYesNo(`Uninstall plugin "${pluginId}"?`);
    if (!confirmed) {
      console.log("Cancelled.");
    }
    return confirmed;
  };

  private runUninstallMutation = async (id: string, opts: PluginsUninstallOptions): Promise<void> => {
    try {
      const result = await uninstallPluginMutation(id, opts);
      for (const warning of result.warnings) {
        console.warn(warning);
      }
      console.log(result.message);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  };

  private loadStatusReport = (): { config: Config; report: PluginStatusReport; workspaceDir: string } => {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    return {
      config,
      workspaceDir,
      report: buildPluginStatusReport({
        config,
        workspaceDir,
        ...buildReservedPluginLoadOptions()
      })
    };
  };

  private buildPluginInfoLines = (plugin: PluginStatusEntry, config: Config): string[] => {
    const install = config.plugins.installs?.[plugin.id];
    const lines = this.buildPluginSummaryLines(plugin);
    if (install) {
      lines.push("");
      lines.push(`Install: ${install.source}`);
      this.pushOptionalLine(lines, "Spec", install.spec);
      this.pushOptionalLine(lines, "Source path", install.sourcePath);
      this.pushOptionalLine(lines, "Install path", install.installPath);
      this.pushOptionalLine(lines, "Recorded version", install.version);
      this.pushOptionalLine(lines, "Installed at", install.installedAt);
    }
    return lines;
  };

  private buildPluginSummaryLines = (plugin: PluginStatusEntry): string[] => {
    const lines = [plugin.name || plugin.id];
    if (plugin.name && plugin.name !== plugin.id) {
      lines.push(`id: ${plugin.id}`);
    }
    if (plugin.description) {
      lines.push(plugin.description);
    }
    lines.push("", `Status: ${plugin.status}`, `Source: ${plugin.source}`, `Origin: ${plugin.origin}`);
    this.pushOptionalLine(lines, "Version", plugin.version);
    appendPluginCapabilityLines(lines, plugin);
    this.pushOptionalLine(lines, "Error", plugin.error);
    return lines;
  };

  private pushOptionalLine = (lines: string[], label: string, value: string | undefined): void => {
    if (value) {
      lines.push(`${label}: ${value}`);
    }
  };

  private assertPluginCanUninstall = (
    requestedId: string,
    pluginId: string,
    plugin: PluginStatusEntry | undefined,
    hasEntry: boolean,
    hasInstall: boolean,
  ): void => {
    if (hasEntry || hasInstall) {
      return;
    }
    if (plugin) {
      console.error(`Plugin "${pluginId}" is not managed by plugins config/install records and cannot be uninstalled.`);
    } else {
      console.error(`Plugin not found: ${requestedId}`);
    }
    process.exit(1);
  };

  private buildUninstallPreview = (params: {
    config: Config;
    pluginId: string;
    hasEntry: boolean;
    hasInstall: boolean;
    keepFiles: boolean;
    install: PluginInstallRecord | undefined;
  }): string[] => {
    const { config, hasEntry, hasInstall, install, keepFiles, pluginId } = params;
    const preview = this.buildUninstallConfigPreview({ config, hasEntry, hasInstall, install, pluginId });
    if (!keepFiles) {
      for (const deleteTarget of resolveUninstallDirectoryTargets({ config, pluginId, hasInstall, installRecord: install })) {
        preview.push(`directory: ${deleteTarget}`);
      }
    }
    return preview;
  };

  private buildUninstallConfigPreview = (params: {
    config: Config;
    pluginId: string;
    hasEntry: boolean;
    hasInstall: boolean;
    install: PluginInstallRecord | undefined;
  }): string[] => {
    const { config, hasEntry, hasInstall, install, pluginId } = params;
    const preview: string[] = [];
    const isLinked =
      install?.source === "path" &&
      (!install.installPath || !install.sourcePath || resolve(install.installPath) === resolve(install.sourcePath));
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
    return preview;
  };
}
