import {
  buildReloadPlan,
  diffConfigPaths,
  type Config,
  type ExtensionRegistry,
  type LLMProvider,
  ChannelManager,
  type MessageBus,
  type ProviderManager,
  type SessionManager
} from "@nextclaw/core";

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
      bus: MessageBus;
      sessionManager: SessionManager;
      providerManager: ProviderManager | null;
      makeProvider: (config: Config) => LLMProvider | null;
      loadConfig: () => Config;
      getExtensionChannels?: () => ExtensionRegistry["channels"];
      applyAgentRuntimeConfig?: (config: Config) => void;
      onRestartRequired: (paths: string[]) => void;
    }
  ) {
    this.currentConfig = options.initialConfig;
    this.channels = options.channels;
  }

  getChannels(): ChannelManager {
    return this.channels;
  }

  setApplyAgentRuntimeConfig(callback: ((config: Config) => void) | undefined): void {
    this.options.applyAgentRuntimeConfig = callback;
  }

  async applyReloadPlan(nextConfig: Config): Promise<void> {
    const changedPaths = diffConfigPaths(this.currentConfig, nextConfig);
    if (!changedPaths.length) {
      return;
    }
    this.currentConfig = nextConfig;
    this.options.providerManager?.setConfig(nextConfig);
    const plan = buildReloadPlan(changedPaths);
    if (plan.restartChannels) {
      await this.reloadChannels(nextConfig);
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
  }

  scheduleReload(reason: string): void {
    if (this.reloadTimer) {
      clearTimeout(this.reloadTimer);
    }
    this.reloadTimer = setTimeout(() => {
      void this.runReload(reason);
    }, 300);
  }

  async runReload(reason: string): Promise<void> {
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
  }

  async reloadConfig(reason?: string): Promise<string> {
    await this.runReload(reason ?? "gateway tool");
    return "Config reload triggered";
  }

  private async reloadChannels(nextConfig: Config): Promise<void> {
    if (this.reloadTask) {
      await this.reloadTask;
      return;
    }
    this.reloadTask = (async () => {
      await this.channels.stopAll();
      this.channels = new ChannelManager(
        nextConfig,
        this.options.bus,
        this.options.sessionManager,
        this.options.getExtensionChannels?.() ?? []
      );
      await this.channels.startAll();
    })();
    try {
      await this.reloadTask;
    } finally {
      this.reloadTask = null;
    }
  }

  private async reloadProvider(nextConfig: Config): Promise<void> {
    if (!this.options.providerManager) {
      return;
    }
    if (this.providerReloadTask) {
      await this.providerReloadTask;
      return;
    }
    this.providerReloadTask = (async () => {
      const nextProvider = this.options.makeProvider(nextConfig);
      if (!nextProvider) {
        console.warn("Provider reload skipped: missing API key.");
        return;
      }
      this.options.providerManager?.setConfig(nextConfig);
      this.options.providerManager?.set(nextProvider);
    })();
    try {
      await this.providerReloadTask;
    } finally {
      this.providerReloadTask = null;
    }
  }
}
