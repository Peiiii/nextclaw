import {
  buildReloadPlan,
  diffConfigPaths,
  getConfigPath,
  loadConfig,
  resolveConfigSecrets,
  type ChannelManager,
  type Config,
  type ExtensionRegistry,
} from "@nextclaw/core";
import type { LlmProviderManager } from "./llm-provider.manager.js";

export type ConfigManagerRuntimeHooks = {
  resolveChannelConfig?: (config: Config) => Config;
  getExtensionChannels?: () => ExtensionRegistry["channels"];
  applyAgentRuntimeConfig?: (config: Config) => void;
  reloadCompanion?: (params: { config: Config; changedPaths: string[] }) => Promise<void> | void;
  reloadMcp?: (params: { config: Config; changedPaths: string[] }) => Promise<void> | void;
  reloadPlugins?: (
    params: { config: Config; changedPaths: string[] },
  ) => Promise<{ restartChannels?: boolean } | void> | { restartChannels?: boolean } | void;
  onRestartRequired?: (paths: string[]) => void;
};

export type ConfigManagerOptions = {
  configPath?: string;
  channels: ChannelManager;
  providerManager: LlmProviderManager;
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

  installRuntimeHooks = (hooks: ConfigManagerRuntimeHooks): void => {
    this.hooks = hooks;
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

    let reloadPluginsResult: { restartChannels?: boolean } | void = undefined;
    if (plan.reloadPlugins) {
      reloadPluginsResult = await this.reloadPlugins({
        config: nextConfig,
        changedPaths,
      });
      console.log("Config reload: plugins reloaded.");
    }
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
    if (plan.restartChannels || reloadPluginsResult?.restartChannels) {
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

  private reloadPlugins = async (params: {
    config: Config;
    changedPaths: string[];
  }): Promise<{ restartChannels?: boolean } | void> => {
    return await this.hooks.reloadPlugins?.(params);
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
}
