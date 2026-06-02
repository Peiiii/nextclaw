import {
  buildConfigSchema,
  buildReloadPlan,
  ConfigSchema,
  diffConfigPaths,
  getConfigPath,
  loadConfig,
  normalizeInlineSecretRefs,
  redactConfigObject,
  resolveConfigSecrets,
  saveConfig,
  type ChannelManager,
  type Config,
  type ExtensionRegistry,
} from "@nextclaw/core";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import type { LlmProviderManager } from "./llm-provider.manager.js";

export type ConfigManagerRuntimeHooks = {
  resolveChannelConfig?: (config: Config) => Config;
  getExtensionChannels?: () => ExtensionRegistry["channels"];
  applyAgentRuntimeConfig?: (config: Config) => void;
  reloadCompanion?: (params: { config: Config; changedPaths: string[] }) => Promise<void> | void;
  reloadMcp?: (params: { config: Config; changedPaths: string[] }) => Promise<void> | void;
  onRestartRequired?: (paths: string[]) => void;
};

export type ConfigManagerOptions = {
  configPath?: string;
  channels: ChannelManager;
  providerManager: LlmProviderManager;
};

export type ConfigMutationResult = Record<string, unknown> & { ok: boolean; error?: string };

type ConfigSnapshot = { raw: string | null; hash: string | null; config: Config; redacted: Record<string, unknown>; valid: boolean };
type RawConfigMutationParams = { raw: string; baseHash?: string; note?: string; version?: string };

const hashRaw = (raw: string): string => createHash("sha256").update(raw).digest("hex");

const mergeDeep = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const baseVal = base[key];
      next[key] = baseVal && typeof baseVal === "object" && !Array.isArray(baseVal)
        ? mergeDeep(baseVal as Record<string, unknown>, value as Record<string, unknown>)
        : mergeDeep({}, value as Record<string, unknown>);
      continue;
    }
    next[key] = value;
  }
  return next;
};

export class ConfigManager {
  readonly configPath: string;
  private currentConfig: Config;
  private hooks: ConfigManagerRuntimeHooks = {};
  private reloadTask: Promise<void> | null = null;
  private providerReloadTask: Promise<void> | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private reloadRunning = false;
  private reloadPending = false;

  constructor(private readonly options: ConfigManagerOptions) {
    this.configPath = options.configPath ?? getConfigPath();
    this.currentConfig = this.loadConfig();
    this.options.providerManager.load(this.currentConfig);
    this.options.channels.load({
      channelConfig: this.resolveChannelConfig(this.currentConfig),
      extensionChannels: this.resolveExtensionChannels(),
    });
  }

  get config(): Config {
    return this.currentConfig;
  }

  loadConfig = (): Config =>
    resolveConfigSecrets(loadConfig(this.configPath), { configPath: this.configPath });

  getDefaultModel = (): string =>
    this.loadConfig().agents.defaults.model;

  getModelMaxTokens = (model: string): number | undefined => {
    const value = this.loadConfig().agents.defaults.models[model]?.params?.max_tokens;
    return typeof value === "number" ? Math.trunc(value) : undefined;
  };

  installRuntimeHooks = (hooks: ConfigManagerRuntimeHooks): void => {
    this.hooks = { ...this.hooks, ...hooks };
  };

  applyLiveConfigReload = async (): Promise<void> => {
    await this.applyReloadPlan(this.loadConfig());
  };

  applyReloadPlan = async (nextConfig: Config): Promise<void> => {
    const changedPaths = diffConfigPaths(this.currentConfig, nextConfig);
    if (!changedPaths.length) {
      return;
    }
    this.currentConfig = nextConfig;
    const plan = buildReloadPlan(changedPaths);

    if (plan.reloadMcp) {
      await this.reloadMcp({
        config: nextConfig,
        changedPaths,
      });
      console.log("Config reload: MCP servers reloaded.");
    }
    if (plan.reloadCompanion) {
      await this.reloadCompanion({
        config: nextConfig,
        changedPaths,
      });
      console.log("Config reload: companion setting applied.");
    }
    if (plan.restartChannels) {
      await this.rebuildChannels(nextConfig, { start: true });
      console.log("Config reload: channels restarted.");
    }
    if (plan.reloadProviders) {
      await this.reloadProvider(nextConfig);
      console.log("Config reload: provider settings applied.");
    }
    if (plan.reloadAgent) {
      this.hooks.applyAgentRuntimeConfig?.(nextConfig);
      console.log("Config reload: agent defaults applied.");
    }
    if (plan.restartRequired.length > 0) {
      this.hooks.onRestartRequired?.(plan.restartRequired);
    }
  };

  getConfigSnapshot = (params: { version?: string } = {}): Record<string, unknown> => {
    const { hash, raw, redacted, valid } = this.readConfigSnapshot(params);
    return {
      raw,
      hash,
      path: this.configPath,
      config: redacted,
      parsed: redacted,
      resolved: redacted,
      valid,
    };
  };

  getConfigSchema = (params: { version?: string } = {}): Record<string, unknown> => buildConfigSchema({ version: params.version });

  applyRawConfig = async (params: RawConfigMutationParams): Promise<ConfigMutationResult> =>
    this.mutateRawConfig(params, (_snapshot, parsed) => parsed);

  patchRawConfig = async (params: RawConfigMutationParams): Promise<ConfigMutationResult> =>
    this.mutateRawConfig(params, (snapshot, patch) => mergeDeep(snapshot.config as Record<string, unknown>, patch));

  applyConfig = async (nextConfig: Config, note?: string): Promise<ConfigMutationResult> =>
    this.applyConfigChange({ nextConfig, note });

  scheduleReload = (reason: string): void => {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = setTimeout(() => {
      void this.runReload(reason);
    }, 300);
  };

  runReload = async (reason: string): Promise<void> => {
    if (this.reloadRunning) {
      this.reloadPending = true;
      return;
    }
    this.reloadRunning = true;
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
      this.reloadTimer = null;
    }
    try {
      await this.applyLiveConfigReload();
    } catch (error) {
      console.error(`Config reload failed (${reason}): ${String(error)}`);
    } finally {
      this.reloadRunning = false;
      if (this.reloadPending) {
        this.reloadPending = false;
        this.scheduleReload("pending");
      }
    }
  };

  reloadConfig = async (reason?: string): Promise<string> => {
    await this.runReload(reason ?? "gateway tool");
    return "Config reload triggered";
  };

  rebuildChannels = async (nextConfig: Config, options: { start?: boolean } = {}): Promise<void> => {
    if (this.reloadTask) {
      await this.reloadTask;
      return;
    }
    this.reloadTask = (async () => {
      await this.options.channels.reload({
        channelConfig: this.resolveChannelConfig(nextConfig),
        extensionChannels: this.resolveExtensionChannels(),
        start: options.start ?? true,
      });
    })();
    try {
      await this.reloadTask;
    } finally {
      this.reloadTask = null;
    }
  };

  private resolveChannelConfig = (config: Config): Config =>
    this.hooks.resolveChannelConfig?.(config) ?? config;

  private resolveExtensionChannels = (): ExtensionRegistry["channels"] =>
    this.hooks.getExtensionChannels?.() ?? [];

  private reloadProvider = async (nextConfig: Config): Promise<void> => {
    if (this.providerReloadTask) {
      await this.providerReloadTask;
      return;
    }
    this.providerReloadTask = (async () => {
      this.options.providerManager.load(nextConfig);
    })();
    try {
      await this.providerReloadTask;
    } finally {
      this.providerReloadTask = null;
    }
  };

  private reloadMcp = async (params: {
    config: Config;
    changedPaths: string[];
  }): Promise<void> => {
    await this.hooks.reloadMcp?.(params);
  };

  private reloadCompanion = async (params: {
    config: Config;
    changedPaths: string[];
  }): Promise<void> => {
    await this.hooks.reloadCompanion?.(params);
  };

  private readConfigSnapshot = (params: { version?: string } = {}): ConfigSnapshot => {
    let raw = "";
    let parsed: Record<string, unknown> = {};
    if (existsSync(this.configPath)) {
      raw = readFileSync(this.configPath, "utf-8");
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    }

    let config: Config;
    let valid = true;
    try {
      config = ConfigSchema.parse(normalizeInlineSecretRefs(parsed));
    } catch {
      config = ConfigSchema.parse({});
      valid = false;
    }
    if (!raw) {
      raw = JSON.stringify(config, null, 2);
    }
    const hash = hashRaw(raw);
    return {
      raw: valid ? JSON.stringify(this.redactConfig(config, params), null, 2) : null,
      hash: valid ? hash : null,
      config,
      redacted: this.redactConfig(config, params),
      valid,
    };
  };

  private redactConfig = (config: Config, params: { version?: string } = {}): Record<string, unknown> => {
    const schema = buildConfigSchema({ version: params.version });
    return redactConfigObject(config, schema.uiHints) as Record<string, unknown>;
  };

  private validateBaseHash = (baseHash: string | undefined, snapshot: ConfigSnapshot): ConfigMutationResult | null => {
    if (!baseHash) {
      return { ok: false, error: "config base hash required; re-run config.get and retry" };
    }
    if (!snapshot.valid || !snapshot.hash) {
      return { ok: false, error: "config base hash unavailable; re-run config.get and retry" };
    }
    if (baseHash !== snapshot.hash) {
      return { ok: false, error: "config changed since last load; re-run config.get and retry" };
    }
    return null;
  };

  private validateConfigInput = (input: Record<string, unknown>): { ok: true; config: Config } | { ok: false; error: string } => {
    try {
      return { ok: true, config: ConfigSchema.parse(normalizeInlineSecretRefs(input)) };
    } catch (error) {
      return { ok: false, error: `invalid config: ${String(error)}` };
    }
  };

  private mutateRawConfig = async (
    params: RawConfigMutationParams,
    resolveInput: (snapshot: ConfigSnapshot, parsed: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<ConfigMutationResult> => {
    const { baseHash, note, raw, version } = params;
    const snapshot = this.readConfigSnapshot({ version });
    const baseHashValidation = this.validateBaseHash(baseHash, snapshot);
    if (baseHashValidation) {
      return baseHashValidation;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "invalid JSON in raw config" };
    }

    const validated = this.validateConfigInput(resolveInput(snapshot, parsed));
    return validated.ok
      ? this.applyConfigChange({ nextConfig: validated.config, note, version })
      : validated;
  };

  private applyConfigChange = async (params: {
    nextConfig: Config;
    note?: string;
    version?: string;
  }): Promise<ConfigMutationResult> => {
    const { nextConfig, note, version } = params;
    const changedPaths = diffConfigPaths(this.readConfigSnapshot({ version }).config, nextConfig);

    if (changedPaths.length === 0) {
      return this.createConfigMutationResult({
        changedPaths,
        config: nextConfig,
        note,
        version,
      });
    }

    saveConfig(nextConfig, this.configPath);
    await this.applyReloadPlan(nextConfig);
    return this.createConfigMutationResult({
      changedPaths,
      config: nextConfig,
      note,
      version,
    });
  };

  private createConfigMutationResult = (params: {
    changedPaths: string[];
    config: Config;
    note?: string;
    version?: string;
  }): ConfigMutationResult => {
    const { changedPaths, config, note, version } = params;
    const plan = buildReloadPlan(changedPaths);
    const pendingRestart =
      plan.restartRequired.length > 0
        ? {
            required: true as const,
            automatic: false as const,
            changedPaths: [...plan.restartRequired],
            message: `Config saved. Restart manually to apply: ${plan.restartRequired.join(", ")}.`,
          }
        : null;
    const message =
      changedPaths.length === 0
        ? "Config already matched the requested state."
        : pendingRestart
          ? changedPaths.length > plan.restartRequired.length
            ? "Config saved. Supported changes were applied immediately; restart manually to apply the rest."
            : "Config saved. Restart manually to apply changes."
          : "Config saved and applied.";

    return {
      ok: true,
      note: note ?? null,
      path: this.configPath,
      config: this.redactConfig(config, { version }),
      changedPaths: [...changedPaths],
      message,
      pendingRestart,
    };
  };
}
