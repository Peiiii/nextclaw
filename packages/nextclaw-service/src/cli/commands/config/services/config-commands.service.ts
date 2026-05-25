import { buildReloadPlan, diffConfigPaths, loadConfig, saveConfig, type Config } from "@nextclaw/core";
import { getAtConfigPath, parseConfigSetValue, parseRequiredConfigPath, setAtConfigPath, unsetAtConfigPath } from "@nextclaw-service/shared/utils/config-path.js";
import { resolveChannelConfigView } from "@nextclaw-service/commands/channel/index.js";
import type { ConfigGetOptions, ConfigSetOptions, RequestRestartParams } from "@nextclaw-service/shared/types/cli.types.js";

export class ConfigCommands {
  constructor(
    private deps: {
      requestRestart: (params: RequestRestartParams) => Promise<void>;
    }
  ) {}

  get = (pathExpr: string, opts: ConfigGetOptions = {}): void => {
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
  };

  set = async (pathExpr: string, value: string, opts: ConfigSetOptions = {}): Promise<void> => {
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
    const nextConfigTarget = structuredClone(prevConfig) as unknown as Record<string, unknown>;
    try {
      setAtConfigPath(nextConfigTarget, parsedPath, parsedValue);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
      return;
    }

    const nextConfig = nextConfigTarget as Config;
    saveConfig(nextConfig as Config);
    await this.requestRestartForConfigDiff({
      prevConfig,
      nextConfig: nextConfig as Config,
      reason: `config.set ${pathExpr}`,
      manualMessage: `Updated ${pathExpr}. Restart the gateway to apply.`
    });
  };

  unset = async (pathExpr: string): Promise<void> => {
    let parsedPath: string[];
    try {
      parsedPath = parseRequiredConfigPath(pathExpr);
    } catch (error) {
      console.error(String(error));
      process.exit(1);
      return;
    }

    const prevConfig = loadConfig();
    const nextConfigTarget = structuredClone(prevConfig) as unknown as Record<string, unknown>;
    const removed = unsetAtConfigPath(nextConfigTarget, parsedPath);
    if (!removed) {
      console.error(`Config path not found: ${pathExpr}`);
      process.exit(1);
      return;
    }

    const nextConfig = nextConfigTarget as Config;
    saveConfig(nextConfig as Config);
    await this.requestRestartForConfigDiff({
      prevConfig,
      nextConfig: nextConfig as Config,
      reason: `config.unset ${pathExpr}`,
      manualMessage: `Removed ${pathExpr}. Restart the gateway to apply.`
    });
  };

  private resolveReadConfigView = (config: Config, parsedPath: string[]): Config => {
    if (parsedPath[0] !== "channels") {
      return config;
    }
    return resolveChannelConfigView(config);
  };

  private requestRestartForConfigDiff = async (params: {
    prevConfig: Config;
    nextConfig: Config;
    reason: string;
    manualMessage: string;
  }): Promise<void> => {
    const { manualMessage, nextConfig, prevConfig, reason } = params;
    const changedPaths = diffConfigPaths(prevConfig, nextConfig);
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
      reason: `${reason} (${plan.restartRequired.join(", ")})`,
      manualMessage
    });
  };
}
