import { spawnSync } from "node:child_process";
import { getWorkspacePath, loadConfig, saveConfig } from "@nextclaw/core";
import { BUILTIN_CHANNEL_PLUGIN_IDS, builtinProviderIds } from "@nextclaw/runtime";
import { buildPluginStatusReport, enablePluginInConfig, getPluginChannelBindings } from "@nextclaw/openclaw-compat";
import { loadPluginRegistry, mergePluginConfigView, toPluginConfigView } from "./plugins.js";
import { resolveChannelConfigView } from "./channel-config-view.js";
import type { ChannelsAddOptions, ChannelsLoginOptions, RequestRestartParams } from "../types.js";

const CHANNEL_LABELS: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  discord: "Discord",
  feishu: "Feishu",
  mochat: "Mochat",
  dingtalk: "DingTalk",
  wecom: "WeCom",
  email: "Email",
  slack: "Slack",
  qq: "QQ"
};
const RESERVED_PROVIDER_IDS = builtinProviderIds();

type PluginChannelBinding = ReturnType<typeof getPluginChannelBindings>[number];
type PluginLoginResult = {
  pluginConfig: Record<string, unknown>;
  accountId?: string | null;
  notes?: string[];
};

type PluginChannelContext = {
  binding: PluginChannelBinding;
  bindings: PluginChannelBinding[];
};

export class ChannelCommands {
  constructor(
    private deps: {
      logo: string;
      getBridgeDir: () => string;
      requestRestart: (params: RequestRestartParams) => Promise<void>;
    }
  ) {}

  channelsStatus(): void {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const pluginRegistry = loadPluginRegistry(config, workspaceDir);
    const channelConfig = resolveChannelConfigView(config, getPluginChannelBindings(pluginRegistry));

    console.log("Channel Status");
    const channels = channelConfig.channels as Record<string, { enabled?: boolean }>;
    for (const channelId of BUILTIN_CHANNEL_PLUGIN_IDS) {
      const label = CHANNEL_LABELS[channelId] ?? channelId;
      const enabled = channels[channelId]?.enabled === true;
      console.log(`${label}: ${enabled ? "✓" : "✗"}`);
    }

    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      reservedChannelIds: [],
      reservedProviderIds: RESERVED_PROVIDER_IDS
    });

    const pluginChannels = report.plugins.filter((plugin) => plugin.status === "loaded" && plugin.channelIds.length > 0);
    if (pluginChannels.length > 0) {
      console.log("Plugin Channels:");
      for (const plugin of pluginChannels) {
        const channels = plugin.channelIds.join(", ");
        console.log(`- ${channels} (plugin: ${plugin.id})`);
      }
    }
  }

  async channelsLogin(opts: ChannelsLoginOptions = {}): Promise<void> {
    const channelId = opts.channel?.trim();
    if (!channelId) {
      this.runLegacyBridgeLogin();
      return;
    }

    const config = loadConfig();
    const channelContext = this.resolvePluginChannelContext(config, channelId);
    if (!channelContext) {
      console.error(`No plugin channel found for: ${channelId}`);
      process.exit(1);
    }

    const result = await this.loginPluginChannel(config, channelContext, opts);
    if (!result) {
      return;
    }

    saveConfig(this.buildNextConfigAfterChannelLogin(config, channelContext.binding, result));
    this.printPluginChannelLoginResult(channelContext.binding, result);
    await this.deps.requestRestart({
      reason: `channel login via plugin: ${channelContext.binding.pluginId}`,
      manualMessage: "Restart the gateway to apply changes."
    });
  }

  private runLegacyBridgeLogin(): void {
    const bridgeDir = this.deps.getBridgeDir();
    console.log(`${this.deps.logo} Starting bridge...`);
    console.log("Scan the QR code to connect.\n");
    const result = spawnSync("npm", ["start"], { cwd: bridgeDir, stdio: "inherit" });
    if (result.status !== 0) {
      console.error(`Bridge failed: ${result.status ?? 1}`);
    }
  }

  private resolvePluginChannelContext(config: ReturnType<typeof loadConfig>, channelId: string): PluginChannelContext | null {
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const pluginRegistry = loadPluginRegistry(config, workspaceDir);
    const bindings = getPluginChannelBindings(pluginRegistry);
    const binding = bindings.find((entry) => entry.channelId === channelId || entry.pluginId === channelId);
    if (!binding) {
      return null;
    }
    return { binding, bindings };
  }

  private async loginPluginChannel(
    config: ReturnType<typeof loadConfig>,
    channelContext: PluginChannelContext,
    opts: ChannelsLoginOptions,
  ): Promise<PluginLoginResult | null> {
    const { binding, bindings } = channelContext;
    const login = binding.channel.auth?.login;
    if (!login) {
      if (binding.channelId === "whatsapp") {
        this.runLegacyBridgeLogin();
        return null;
      }
      console.error(`Channel "${binding.channelId}" does not support login.`);
      process.exit(1);
    }

    const configView = resolveChannelConfigView(config, bindings);
    const result = await login({
      cfg: configView,
      pluginId: binding.pluginId,
      channelId: binding.channelId,
      pluginConfig: this.clonePluginConfig(configView.channels?.[binding.channelId]),
      accountId: opts.account?.trim() || null,
      baseUrl: opts.url?.trim() || opts.httpUrl?.trim() || null,
      verbose: Boolean(opts.verbose)
    });
    this.assertValidPluginLoginResult(result);
    return result;
  }

  private clonePluginConfig(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  }

  private assertValidPluginLoginResult(result: unknown): asserts result is PluginLoginResult {
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      console.error("Channel login returned an invalid result.");
      process.exit(1);
    }
    const record = result as Record<string, unknown>;
    if (!record.pluginConfig || typeof record.pluginConfig !== "object" || Array.isArray(record.pluginConfig)) {
      console.error("Channel login returned an invalid plugin config.");
      process.exit(1);
    }
  }

  private buildNextConfigAfterChannelLogin(
    config: ReturnType<typeof loadConfig>,
    binding: PluginChannelBinding,
    result: PluginLoginResult,
  ): ReturnType<typeof loadConfig> {
    const nextConfig = {
      ...config,
      channels: {
        ...config.channels,
        [binding.channelId]: result.pluginConfig as ReturnType<typeof loadConfig>["channels"][keyof ReturnType<typeof loadConfig>["channels"]]
      }
    };
    return enablePluginInConfig(nextConfig, binding.pluginId);
  }

  private printPluginChannelLoginResult(binding: PluginChannelBinding, result: PluginLoginResult): void {
    console.log(`Logged into channel "${binding.channelId}" via plugin "${binding.pluginId}".`);
    if (result.accountId) {
      console.log(`Active account: ${result.accountId}`);
    }
    for (const note of result.notes ?? []) {
      console.log(note);
    }
  }

  async channelsAdd(opts: ChannelsAddOptions): Promise<void> {
    const channelId = opts.channel?.trim();
    if (!channelId) {
      console.error("--channel is required");
      process.exit(1);
    }

    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const pluginRegistry = loadPluginRegistry(config, workspaceDir);
    const bindings = getPluginChannelBindings(pluginRegistry);

    const binding = bindings.find((entry) => entry.channelId === channelId || entry.pluginId === channelId);
    if (!binding) {
      console.error(`No plugin channel found for: ${channelId}`);
      process.exit(1);
    }

    const setup = binding.channel.setup;
    if (!setup?.applyAccountConfig) {
      console.error(`Channel "${binding.channelId}" does not support setup.`);
      process.exit(1);
    }

    const input = {
      name: opts.name,
      token: opts.token,
      code: opts.code,
      url: opts.url,
      httpUrl: opts.httpUrl
    };

    const currentView = toPluginConfigView(config, bindings);
    const accountId = binding.channel.config?.defaultAccountId?.(currentView) ?? "default";

    const validateError = setup.validateInput?.({
      cfg: currentView,
      input,
      accountId
    });
    if (validateError) {
      console.error(`Channel setup validation failed: ${validateError}`);
      process.exit(1);
    }

    const nextView = setup.applyAccountConfig({
      cfg: currentView,
      input,
      accountId
    });

    if (!nextView || typeof nextView !== "object" || Array.isArray(nextView)) {
      console.error("Channel setup returned invalid config payload.");
      process.exit(1);
    }

    let next = mergePluginConfigView(config, nextView as Record<string, unknown>, bindings);
    next = enablePluginInConfig(next, binding.pluginId);
    saveConfig(next);

    console.log(`Configured channel "${binding.channelId}" via plugin "${binding.pluginId}".`);
    await this.deps.requestRestart({
      reason: `channel configured via plugin: ${binding.pluginId}`,
      manualMessage: "Restart the gateway to apply changes."
    });
  }
}
