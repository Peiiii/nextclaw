import { buildReloadPlan, diffConfigPaths, getWorkspacePath, loadConfig, saveConfig, type Config } from "@nextclaw/core";
import { getPluginChannelBindings } from "@nextclaw/openclaw-compat";
import {
  getAtConfigPath,
  parseConfigSetValue,
  parseRequiredConfigPath,
  setAtConfigPath,
  unsetAtConfigPath
} from "../shared/utils/config-path.js";
import { resolveChannelConfigView } from "./channel/channel-config-view.js";
import { loadPluginRegistry, mergePluginConfigView } from "./plugins.js";
import type { ConfigGetOptions, ConfigSetOptions, RequestRestartParams } from "../shared/types/cli.types.js";

export class ConfigCommands {
  constructor(
    private deps: {
      requestRestart: (params: RequestRestartParams) => Promise<void>;
    }
  ) {}

  configGet(pathExpr: string, opts: ConfigGetOptions = {}): void {
    let parsedPath: string[];
    try {
      parsedPath = parseRequiredConfigPath(pathExpr);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
      return;
    }

    const config = loadConfig();
    const resolvedConfig = this.resolveReadConfigView(config, parsedPath) as unknown as Record<string, unknown>;
    const result = getAtConfigPath(resolvedConfig, parsedPath);
    if (!result.found) {
      console.error(`Config path not found: ${pathExpr}`);
      process.exit(1);
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(result.value ?? null, null, 2));
      return;
    }

    if (
      typeof result.value === "string" ||
      typeof result.value === "number" ||
      typeof result.value === "boolean"
    ) {
      console.log(String(result.value));
      return;
    }

    console.log(JSON.stringify(result.value ?? null, null, 2));
  }

  async configSet(pathExpr: string, value: string, opts: ConfigSetOptions = {}): Promise<void> {
    let parsedPath: string[];
    try {
      parsedPath = parseRequiredConfigPath(pathExpr);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
      return;
    }

    let parsedValue: unknown;
    try {
      parsedValue = parseConfigSetValue(value, opts);
    } catch (error) {
      console.error(`Failed to parse config value: ${String(error)}`);
      process.exit(1);
      return;
    }

    const prevConfig = loadConfig();
    const projectedContext = this.resolveProjectedChannelContext(prevConfig, parsedPath);
    const nextConfigTarget = projectedContext
      ? structuredClone(projectedContext.view) as unknown as Record<string, unknown>
      : structuredClone(prevConfig) as unknown as Record<string, unknown>;
    try {
      setAtConfigPath(nextConfigTarget, parsedPath, parsedValue);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
      return;
    }

    const nextConfig = projectedContext
      ? mergePluginConfigView(prevConfig, nextConfigTarget, projectedContext.bindings)
      : nextConfigTarget as Config;
    saveConfig(nextConfig as Config);
    await this.requestRestartForConfigDiff({
      prevConfig,
      nextConfig: nextConfig as Config,
      reason: `config.set ${pathExpr}`,
      manualMessage: `Updated ${pathExpr}. Restart the gateway to apply.`
    });
  }

  async configUnset(pathExpr: string): Promise<void> {
    let parsedPath: string[];
    try {
      parsedPath = parseRequiredConfigPath(pathExpr);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
      return;
    }

    const prevConfig = loadConfig();
    const projectedContext = this.resolveProjectedChannelContext(prevConfig, parsedPath);
    const nextConfigTarget = projectedContext
      ? structuredClone(projectedContext.view) as unknown as Record<string, unknown>
      : structuredClone(prevConfig) as unknown as Record<string, unknown>;
    const removed = unsetAtConfigPath(nextConfigTarget, parsedPath);
    if (!removed) {
      console.error(`Config path not found: ${pathExpr}`);
      process.exit(1);
      return;
    }

    const nextConfig = projectedContext
      ? mergePluginConfigView(prevConfig, nextConfigTarget, projectedContext.bindings)
      : nextConfigTarget as Config;
    saveConfig(nextConfig as Config);
    await this.requestRestartForConfigDiff({
      prevConfig,
      nextConfig: nextConfig as Config,
      reason: `config.unset ${pathExpr}`,
      manualMessage: `Removed ${pathExpr}. Restart the gateway to apply.`
    });
  }

  private resolveReadConfigView(config: Config, parsedPath: string[]): Config {
    if (parsedPath[0] !== "channels") {
      return config;
    }
    const { bindings } = this.loadPluginChannelBindings(config);
    return resolveChannelConfigView(config, bindings);
  }

  private resolveProjectedChannelContext(config: Config, parsedPath: string[]): {
    bindings: ReturnType<typeof getPluginChannelBindings>;
    view: Config;
  } | null {
    if (parsedPath[0] !== "channels" || parsedPath.length < 2) {
      return null;
    }

    const channelId = parsedPath[1];
    const { bindings } = this.loadPluginChannelBindings(config);
    if (!bindings.some((binding) => binding.channelId === channelId)) {
      return null;
    }

    return {
      bindings,
      view: resolveChannelConfigView(config, bindings)
    };
  }

  private loadPluginChannelBindings(config: Config): {
    bindings: ReturnType<typeof getPluginChannelBindings>;
  } {
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const pluginRegistry = loadPluginRegistry(config, workspaceDir);
    return {
      bindings: getPluginChannelBindings(pluginRegistry)
    };
  }

  private async requestRestartForConfigDiff(params: {
    prevConfig: Config;
    nextConfig: Config;
    reason: string;
    manualMessage: string;
  }): Promise<void> {
    const changedPaths = diffConfigPaths(params.prevConfig, params.nextConfig);
    if (!changedPaths.length) {
      return;
    }
    const plan = buildReloadPlan(changedPaths);
    if (plan.restartRequired.length === 0) {
      return;
    }
    await this.deps.requestRestart({
      changedPaths: plan.restartRequired,
      mode: "notify",
      reason: `${params.reason} (${plan.restartRequired.join(", ")})`,
      manualMessage: params.manualMessage
    });
  }
}
