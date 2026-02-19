import { spawnSync } from "node:child_process";
import { BUILTIN_CHANNEL_PLUGIN_IDS, getWorkspacePath, loadConfig, saveConfig, PROVIDERS } from "@nextclaw/core";
import { buildPluginStatusReport, enablePluginInConfig, getPluginChannelBindings } from "@nextclaw/openclaw-compat";
import { loadPluginRegistry, mergePluginConfigView, toPluginConfigView } from "./plugins.js";
import type { ChannelsAddOptions, RequestRestartParams } from "../types.js";

const CHANNEL_LABELS: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  discord: "Discord",
  feishu: "Feishu",
  mochat: "Mochat",
  dingtalk: "DingTalk",
  email: "Email",
  slack: "Slack",
  qq: "QQ"
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
    console.log("Channel Status");
    const channelConfig = config.channels as Record<string, { enabled?: boolean }>;
    for (const channelId of BUILTIN_CHANNEL_PLUGIN_IDS) {
      const label = CHANNEL_LABELS[channelId] ?? channelId;
      const enabled = channelConfig[channelId]?.enabled === true;
      console.log(`${label}: ${enabled ? "✓" : "✗"}`);
    }

    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const report = buildPluginStatusReport({
      config,
      workspaceDir,
      reservedChannelIds: [],
      reservedProviderIds: PROVIDERS.map((provider) => provider.name)
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

  channelsLogin(): void {
    const bridgeDir = this.deps.getBridgeDir();
    console.log(`${this.deps.logo} Starting bridge...`);
    console.log("Scan the QR code to connect.\n");
    const result = spawnSync("npm", ["start"], { cwd: bridgeDir, stdio: "inherit" });
    if (result.status !== 0) {
      console.error(`Bridge failed: ${result.status ?? 1}`);
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
