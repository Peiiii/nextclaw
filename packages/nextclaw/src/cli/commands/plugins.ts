import {
  addPluginLoadPath,
  buildPluginStatusReport,
  disablePluginInConfig,
  enablePluginInConfig,
  installPluginFromNpmSpec,
  installPluginFromPath,
  loadOpenClawPlugins,
  recordPluginInstall,
  resolveUninstallDirectoryTarget,
  uninstallPlugin,
  type PluginChannelBinding,
  type PluginRegistry
} from "@nextclaw/openclaw-compat";
import {
  loadConfig,
  saveConfig,
  type Config,
  type ExtensionRegistry,
  getWorkspacePath,
  PROVIDERS,
  expandHome
} from "@nextclaw/core";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type {
  PluginsInfoOptions,
  PluginsInstallOptions,
  PluginsListOptions,
  PluginsUninstallOptions,
  RequestRestartParams
} from "../types.js";

export function loadPluginRegistry(config: Config, workspaceDir: string): PluginRegistry {
  return loadOpenClawPlugins({
    config,
    workspaceDir,
    reservedToolNames: [
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
      "sessions_send",
      "memory_search",
      "memory_get",
      "subagents",
      "gateway",
      "cron"
    ],
    reservedChannelIds: [],
    reservedProviderIds: PROVIDERS.map((provider) => provider.name),
    logger: {
      info: (message) => console.log(message),
      warn: (message) => console.warn(message),
      error: (message) => console.error(message),
      debug: (message) => console.debug(message)
    }
  });
}

export function toExtensionRegistry(pluginRegistry: PluginRegistry): ExtensionRegistry {
  return {
    tools: pluginRegistry.tools.map((tool) => ({
      extensionId: tool.pluginId,
      factory: tool.factory,
      names: tool.names,
      optional: tool.optional,
      source: tool.source
    })),
    channels: pluginRegistry.channels.map((channel) => ({
      extensionId: channel.pluginId,
      channel: channel.channel,
      source: channel.source
    })),
    diagnostics: pluginRegistry.diagnostics.map((diag) => ({
      level: diag.level,
      message: diag.message,
      extensionId: diag.pluginId,
      source: diag.source
    }))
  };
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

export function toPluginConfigView(config: Config, bindings: PluginChannelBinding[]): Record<string, unknown> {
  const view = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;
  const channels =
    view.channels && typeof view.channels === "object" && !Array.isArray(view.channels)
      ? ({ ...(view.channels as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  for (const binding of bindings) {
    const pluginConfig = config.plugins.entries?.[binding.pluginId]?.config;
    if (!pluginConfig || typeof pluginConfig !== "object" || Array.isArray(pluginConfig)) {
      continue;
    }
    channels[binding.channelId] = JSON.parse(JSON.stringify(pluginConfig)) as Record<string, unknown>;
  }

  view.channels = channels;
  return view;
}

export function mergePluginConfigView(
  baseConfig: Config,
  pluginViewConfig: Record<string, unknown>,
  bindings: PluginChannelBinding[]
): Config {
  const next = JSON.parse(JSON.stringify(baseConfig)) as Config;
  const pluginChannels =
    pluginViewConfig.channels && typeof pluginViewConfig.channels === "object" && !Array.isArray(pluginViewConfig.channels)
      ? (pluginViewConfig.channels as Record<string, unknown>)
      : {};

  const entries = { ...(next.plugins.entries ?? {}) };

  for (const binding of bindings) {
    if (!Object.prototype.hasOwnProperty.call(pluginChannels, binding.channelId)) {
      continue;
    }

    const channelConfig = pluginChannels[binding.channelId];
    if (!channelConfig || typeof channelConfig !== "object" || Array.isArray(channelConfig)) {
      continue;
    }

    entries[binding.pluginId] = {
      ...(entries[binding.pluginId] ?? {}),
      config: channelConfig as Record<string, unknown>
    };
  }

  next.plugins = {
    ...next.plugins,
    entries
  };

  return next;
}

export class PluginCommands {
  constructor(
    private deps: {
      requestRestart: (params: RequestRestartParams) => Promise<void>;
    }
  ) {}

  pluginsList(opts: PluginsListOptions = {}): void {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      reservedChannelIds: [],
      reservedProviderIds: PROVIDERS.map((provider) => provider.name)
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
      if (plugin.toolNames.length > 0) {
        console.log(`  tools: ${plugin.toolNames.join(", ")}`);
      }
      if (plugin.channelIds.length > 0) {
        console.log(`  channels: ${plugin.channelIds.join(", ")}`);
      }
      if (plugin.providerIds.length > 0) {
        console.log(`  providers: ${plugin.providerIds.join(", ")}`);
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
      reservedChannelIds: [],
      reservedProviderIds: PROVIDERS.map((provider) => provider.name)
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
    if (plugin.toolNames.length > 0) {
      lines.push(`Tools: ${plugin.toolNames.join(", ")}`);
    }
    if (plugin.channelIds.length > 0) {
      lines.push(`Channels: ${plugin.channelIds.join(", ")}`);
    }
    if (plugin.providerIds.length > 0) {
      lines.push(`Providers: ${plugin.providerIds.join(", ")}`);
    }
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
    const config = loadConfig();
    const next = enablePluginInConfig(config, id);
    saveConfig(next);
    await this.deps.requestRestart({
      reason: `plugin enabled: ${id}`,
      manualMessage: `Enabled plugin "${id}". Restart the gateway to apply.`
    });
  }

  async pluginsDisable(id: string): Promise<void> {
    const config = loadConfig();
    const next = disablePluginInConfig(config, id);
    saveConfig(next);
    await this.deps.requestRestart({
      reason: `plugin disabled: ${id}`,
      manualMessage: `Disabled plugin "${id}". Restart the gateway to apply.`
    });
  }

  async pluginsUninstall(id: string, opts: PluginsUninstallOptions = {}): Promise<void> {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      reservedChannelIds: [],
      reservedProviderIds: PROVIDERS.map((provider) => provider.name)
    });

    const keepFiles = Boolean(opts.keepFiles || opts.keepConfig);
    if (opts.keepConfig) {
      console.log("`--keep-config` is deprecated, use `--keep-files`.");
    }

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

    const deleteTarget = !keepFiles
      ? resolveUninstallDirectoryTarget({
          pluginId,
          hasInstall,
          installRecord: install
        })
      : null;

    if (deleteTarget) {
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

    const result = await uninstallPlugin({
      config,
      pluginId,
      deleteFiles: !keepFiles
    });

    if (!result.ok) {
      console.error(result.error);
      process.exit(1);
    }

    for (const warning of result.warnings) {
      console.warn(warning);
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

    console.log(`Uninstalled plugin "${pluginId}". Removed: ${removed.length > 0 ? removed.join(", ") : "nothing"}.`);
    await this.deps.requestRestart({
      reason: `plugin uninstalled: ${pluginId}`,
      manualMessage: "Restart the gateway to apply changes."
    });
  }

  async pluginsInstall(pathOrSpec: string, opts: PluginsInstallOptions = {}): Promise<void> {
    const fileSpec = this.resolveFileNpmSpecToLocalPath(pathOrSpec);
    if (fileSpec && !fileSpec.ok) {
      console.error(fileSpec.error);
      process.exit(1);
    }
    const normalized = fileSpec && fileSpec.ok ? fileSpec.path : pathOrSpec;
    const resolved = resolve(expandHome(normalized));
    const config = loadConfig();

    if (existsSync(resolved)) {
      if (opts.link) {
        const probe = await installPluginFromPath({ path: resolved, dryRun: true });
        if (!probe.ok) {
          console.error(probe.error);
          process.exit(1);
        }

        let next = addPluginLoadPath(config, resolved);
        next = enablePluginInConfig(next, probe.pluginId);
        next = recordPluginInstall(next, {
          pluginId: probe.pluginId,
          source: "path",
          sourcePath: resolved,
          installPath: resolved,
          version: probe.version
        });

        saveConfig(next);
        console.log(`Linked plugin path: ${resolved}`);
        await this.deps.requestRestart({
          reason: `plugin linked: ${probe.pluginId}`,
          manualMessage: "Restart the gateway to load plugins."
        });
        return;
      }

      const result = await installPluginFromPath({
        path: resolved,
        logger: {
          info: (message) => console.log(message),
          warn: (message) => console.warn(message)
        }
      });

      if (!result.ok) {
        console.error(result.error);
        process.exit(1);
      }

      let next = enablePluginInConfig(config, result.pluginId);
      next = recordPluginInstall(next, {
        pluginId: result.pluginId,
        source: this.isArchivePath(resolved) ? "archive" : "path",
        sourcePath: resolved,
        installPath: result.targetDir,
        version: result.version
      });
      saveConfig(next);
      console.log(`Installed plugin: ${result.pluginId}`);
      await this.deps.requestRestart({
        reason: `plugin installed: ${result.pluginId}`,
        manualMessage: "Restart the gateway to load plugins."
      });
      return;
    }

    if (opts.link) {
      console.error("`--link` requires a local path.");
      process.exit(1);
    }

    if (this.looksLikePath(pathOrSpec)) {
      console.error(`Path not found: ${resolved}`);
      process.exit(1);
    }

    const result = await installPluginFromNpmSpec({
      spec: pathOrSpec,
      logger: {
        info: (message) => console.log(message),
        warn: (message) => console.warn(message)
      }
    });

    if (!result.ok) {
      console.error(result.error);
      process.exit(1);
    }

    let next = enablePluginInConfig(config, result.pluginId);
    next = recordPluginInstall(next, {
      pluginId: result.pluginId,
      source: "npm",
      spec: pathOrSpec,
      installPath: result.targetDir,
      version: result.version
    });
    saveConfig(next);
    console.log(`Installed plugin: ${result.pluginId}`);
    await this.deps.requestRestart({
      reason: `plugin installed: ${result.pluginId}`,
      manualMessage: "Restart the gateway to load plugins."
    });
  }

  pluginsDoctor(): void {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      reservedChannelIds: [],
      reservedProviderIds: PROVIDERS.map((provider) => provider.name)
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

  private resolveFileNpmSpecToLocalPath(
    raw: string
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

  private looksLikePath(raw: string): boolean {
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

  private isArchivePath(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    return lower.endsWith(".zip") || lower.endsWith(".tgz") || lower.endsWith(".tar.gz") || lower.endsWith(".tar");
  }
}
