import {
  buildReloadPlan,
  diffConfigPaths,
  type Config,
  type ExtensionRegistry,
} from "@nextclaw/core";
import type { ChannelManager, LlmProviderManager } from "@nextclaw/kernel";

export class ConfigReloader {
  private currentConfig: Config;
  private channels: ChannelManager;
  private reloadTask: Promise<void> | null = null;
  private providerReloadTask: Promise<void> | null = null;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private reloadRunning = false;
  private reloadPending = false;

  constructor(
    private options: {
      initialConfig: Config;
      channels: ChannelManager;
      providerManager: LlmProviderManager | null;
      loadConfig: () => Config;
      resolveChannelConfig?: (config: Config) => Config;
      getExtensionChannels?: () => ExtensionRegistry["channels"];
      applyAgentRuntimeConfig?: (config: Config) => void;
      reloadCompanion?: (params: { config: Config; changedPaths: string[] }) => Promise<void> | void;
      reloadMcp?: (params: { config: Config; changedPaths: string[] }) => Promise<void> | void;
      reloadPlugins?: (params: { config: Config; changedPaths: string[] }) => Promise<{ restartChannels?: boolean } | void> | { restartChannels?: boolean } | void;
      onRestartRequired: (paths: string[]) => void;
    }
  ) {
    this.currentConfig = options.initialConfig;
    this.channels = options.channels;
    this.channels.load({
      channelConfig: this.resolveChannelConfig(options.initialConfig),
      extensionChannels: this.resolveExtensionChannels(),
    });
  }

  getChannels = (): ChannelManager => {
    return this.channels;
  };

  setApplyAgentRuntimeConfig = (callback: ((config: Config) => void) | undefined): void => {
    this.options.applyAgentRuntimeConfig = callback;
  };

  setReloadPlugins = (
    callback:
      | ((params: { config: Config; changedPaths: string[] }) => Promise<{ restartChannels?: boolean } | void> | { restartChannels?: boolean } | void)
      | undefined
  ): void => {
    this.options.reloadPlugins = callback;
  };

  setReloadMcp = (
    callback:
      | ((params: { config: Config; changedPaths: string[] }) => Promise<void> | void)
      | undefined
  ): void => {
    this.options.reloadMcp = callback;
  };

  setReloadCompanion = (
    callback:
      | ((params: { config: Config; changedPaths: string[] }) => Promise<void> | void)
      | undefined
  ): void => {
    this.options.reloadCompanion = callback;
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
        changedPaths
      });
      console.log("Config reload: plugins reloaded.");
    }
    if (plan.reloadMcp) {
      await this.reloadMcp({
        config: nextConfig,
        changedPaths
      });
      console.log("Config reload: MCP servers reloaded.");
    }
    if (plan.reloadCompanion) {
      await this.reloadCompanion({
        config: nextConfig,
        changedPaths
      });
      console.log("Config reload: companion setting applied.");
    }
    if (plan.restartChannels || reloadPluginsResult?.restartChannels) {
      await this.reloadChannels(nextConfig, { start: true });
      console.log("Config reload: channels restarted.");
    }
    if (plan.reloadProviders) {
      await this.reloadProvider(nextConfig);
      console.log("Config reload: provider settings applied.");
    }
    if (plan.reloadAgent) {
      this.options.applyAgentRuntimeConfig?.(nextConfig);
      console.log("Config reload: agent defaults applied.");
    }
    if (plan.restartRequired.length > 0) {
      this.options.onRestartRequired(plan.restartRequired);
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
      const nextConfig = this.options.loadConfig();
      await this.applyReloadPlan(nextConfig);
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
    await this.reloadChannels(nextConfig, { start: options.start ?? true });
  };

  private readonly reloadChannels = async (nextConfig: Config, options: { start: boolean }): Promise<void> => {
    if (this.reloadTask) {
      await this.reloadTask;
      return;
    }
    this.reloadTask = (async () => {
      await this.channels.reload({
        channelConfig: this.resolveChannelConfig(nextConfig),
        extensionChannels: this.resolveExtensionChannels(),
        start: options.start,
      });
    })();
    try {
      await this.reloadTask;
    } finally {
      this.reloadTask = null;
    }
  };

  private readonly resolveChannelConfig = (config: Config): Config =>
    this.options.resolveChannelConfig?.(config) ?? config;

  private readonly resolveExtensionChannels = (): ExtensionRegistry["channels"] =>
    this.options.getExtensionChannels?.() ?? [];

  private readonly reloadProvider = async (nextConfig: Config): Promise<void> => {
    if (!this.options.providerManager) {
      return;
    }
    if (this.providerReloadTask) {
      await this.providerReloadTask;
      return;
    }
    this.providerReloadTask = (async () => {
      this.options.providerManager?.load(nextConfig);
    })();
    try {
      await this.providerReloadTask;
    } finally {
      this.providerReloadTask = null;
    }
  };

  private readonly reloadPlugins = async (params: {
    config: Config;
    changedPaths: string[];
  }): Promise<{ restartChannels?: boolean } | void> => {
    if (!this.options.reloadPlugins) {
      return;
    }
    return await this.options.reloadPlugins(params);
  };

  private readonly reloadMcp = async (params: {
    config: Config;
    changedPaths: string[];
  }): Promise<void> => {
    if (!this.options.reloadMcp) {
      return;
    }
    await this.options.reloadMcp(params);
  };

  private readonly reloadCompanion = async (params: {
    config: Config;
    changedPaths: string[];
  }): Promise<void> => {
    if (!this.options.reloadCompanion) {
      return;
    }
    await this.options.reloadCompanion(params);
  };
}
