import { getWorkspacePath, loadConfig, saveConfig } from "@nextclaw/core";
import { BUILTIN_CHANNEL_IDS } from "@nextclaw/runtime";
import { listExtensionChannelIds } from "@nextclaw/kernel";
import { resolveChannelConfigView } from "./channel-config-view.utils.js";
import { ChannelListViewService } from "./channel-list-view.service.js";
import type { ChannelsAddOptions, ChannelsListOptions, ChannelsLoginOptions, RequestRestartParams } from "../../shared/types/cli.types.js";

export { resolveChannelConfigView } from "./channel-config-view.utils.js";

const CHANNEL_LABELS: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  discord: "Discord",
  feishu: "Feishu",
  dingtalk: "DingTalk",
  wecom: "WeCom",
  email: "Email",
  slack: "Slack",
  qq: "QQ",
  weixin: "Weixin"
};
export class ChannelCommands {
  private readonly channelListView = new ChannelListViewService();

  constructor(
    private deps: {
      requestRestart: (params: RequestRestartParams) => Promise<void>;
    }
  ) {}

  status = (): void => {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    const channelConfig = resolveChannelConfigView(config);

    console.log("Channel Status");
    const channels = channelConfig.channels as Record<string, { enabled?: boolean }>;
    for (const channelId of BUILTIN_CHANNEL_IDS) {
      const label = CHANNEL_LABELS[channelId] ?? channelId;
      const enabled = channels[channelId]?.enabled === true;
      console.log(`${label}: ${enabled ? "✓" : "✗"}`);
    }

    const extensionChannels = listExtensionChannelIds({ config, workspace: workspaceDir });
    if (extensionChannels.length > 0) {
      console.log("Extension Channels:");
      for (const channelId of extensionChannels) {
        console.log(`- ${channelId}`);
      }
    }
  };

  list = (opts: ChannelsListOptions = {}): void => {
    const output = this.buildChannelListOutput();
    if (opts.json) {
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log("Channels");
    for (const channel of output.channels) {
      const flags = [
        channel.enabled ? "enabled" : "disabled",
        channel.defaultAccountId ? `defaultAccountId=${channel.defaultAccountId}` : undefined,
      ].filter(Boolean);
      console.log(`- ${channel.id} [${flags.join(", ")}]`);
    }
  };

  login = async (opts: ChannelsLoginOptions = {}): Promise<void> => {
    const channelId = opts.channel?.trim();
    if (!channelId) {
      console.error("Channel login is handled by the running UI extension auth flow. Pass --channel <id> and use the UI login flow.");
      process.exit(1);
    }

    console.error(`Channel "${channelId}" login is handled by the running UI extension auth flow.`);
    process.exit(1);
  };

  private buildChannelListOutput = () => {
    const config = loadConfig();
    const workspaceDir = getWorkspacePath(config.agents.defaults.workspace);
    return this.channelListView.build({
      config,
      workspaceDir,
    });
  };

  add = async (opts: ChannelsAddOptions): Promise<void> => {
    const channelId = this.requireChannelId(opts);
    const config = loadConfig();
    const next = {
      ...config,
      channels: {
        ...config.channels,
        [channelId]: {
          ...((config.channels as Record<string, Record<string, unknown>>)[channelId] ?? {}),
          ...this.buildChannelSetupInput(opts),
          enabled: true,
        },
      },
    };
    saveConfig(next);

    console.log(`Configured channel "${channelId}".`);
    await this.deps.requestRestart({
      mode: "notify",
      reason: `channel configured: ${channelId}`,
      manualMessage: "渠道配置已保存，等待你手动重启后生效。"
    });
  };

  private requireChannelId = (opts: ChannelsAddOptions): string => {
    const channelId = opts.channel?.trim();
    if (!channelId) {
      console.error("--channel is required");
      process.exit(1);
    }
    return channelId;
  };

  private buildChannelSetupInput = (opts: ChannelsAddOptions): Record<string, string | undefined> => {
    return {
      name: opts.name,
      token: opts.token,
      code: opts.code,
      url: opts.url,
      httpUrl: opts.httpUrl
    };
  };
}
