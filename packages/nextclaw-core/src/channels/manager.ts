import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import type { BaseChannel } from "./base.js";
import type { SessionManager } from "../session/manager.js";
import { sanitizeOutboundAssistantContent } from "../utils/reasoning-tags.js";
import { TelegramChannel } from "./telegram.js";
import { WhatsAppChannel } from "./whatsapp.js";
import { DiscordChannel } from "./discord.js";
import { FeishuChannel } from "./feishu.js";
import { MochatChannel } from "./mochat.js";
import { DingTalkChannel } from "./dingtalk.js";
import { EmailChannel } from "./email.js";
import { SlackChannel } from "./slack.js";
import { QQChannel } from "./qq.js";
import { ExtensionChannelAdapter } from "./extension_channel.js";
import type { ExtensionChannelRegistration } from "../extensions/types.js";

export class ChannelManager {
  private channels: Record<string, BaseChannel<Record<string, unknown>>> = {};
  private dispatchTask: Promise<void> | null = null;
  private dispatching = false;

  constructor(
    private config: Config,
    private bus: MessageBus,
    private sessionManager?: SessionManager,
    private extensionChannels: ExtensionChannelRegistration[] = []
  ) {
    this.initChannels();
  }

  private initChannels(): void {
    if (this.config.channels.telegram.enabled) {
      const channel = new TelegramChannel(
        this.config.channels.telegram,
        this.bus,
        this.config.providers.groq.apiKey,
        this.sessionManager
      );
      this.channels.telegram = channel;
    }

    if (this.config.channels.whatsapp.enabled) {
      const channel = new WhatsAppChannel(this.config.channels.whatsapp, this.bus);
      this.channels.whatsapp = channel;
    }

    if (this.config.channels.discord.enabled) {
      const channel = new DiscordChannel(this.config.channels.discord, this.bus);
      this.channels.discord = channel;
    }

    if (this.config.channels.feishu.enabled) {
      const channel = new FeishuChannel(this.config.channels.feishu, this.bus);
      this.channels.feishu = channel;
    }

    if (this.config.channels.mochat.enabled) {
      const channel = new MochatChannel(this.config.channels.mochat, this.bus);
      this.channels.mochat = channel;
    }

    if (this.config.channels.dingtalk.enabled) {
      const channel = new DingTalkChannel(this.config.channels.dingtalk, this.bus);
      this.channels.dingtalk = channel;
    }

    if (this.config.channels.email.enabled) {
      const channel = new EmailChannel(this.config.channels.email, this.bus);
      this.channels.email = channel;
    }

    if (this.config.channels.slack.enabled) {
      const channel = new SlackChannel(this.config.channels.slack, this.bus);
      this.channels.slack = channel;
    }

    if (this.config.channels.qq.enabled) {
      const channel = new QQChannel(this.config.channels.qq, this.bus);
      this.channels.qq = channel;
    }

    for (const registration of this.extensionChannels) {
      const id = registration.channel.id;
      if (!id) {
        continue;
      }
      if (this.channels[id]) {
        // eslint-disable-next-line no-console
        console.warn(`Extension channel ignored because id already exists: ${id}`);
        continue;
      }
      this.channels[id] = new ExtensionChannelAdapter(this.config, this.bus, registration);
    }
  }

  private async startChannel(name: string, channel: BaseChannel<Record<string, unknown>>): Promise<void> {
    try {
      await channel.start();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Failed to start channel ${name}: ${String(err)}`);
    }
  }

  async startAll(): Promise<void> {
    if (!Object.keys(this.channels).length) {
      return;
    }
    this.dispatching = true;
    this.dispatchTask = this.dispatchOutbound();
    const tasks = Object.entries(this.channels).map(([name, channel]) => this.startChannel(name, channel));
    await Promise.allSettled(tasks);
  }

  async stopAll(): Promise<void> {
    this.dispatching = false;
    await this.bus.publishOutbound({
      channel: "__control__",
      chatId: "",
      content: "",
      media: [],
      metadata: { reason: "shutdown" }
    });
    if (this.dispatchTask) {
      await this.dispatchTask;
    }
    const tasks = Object.entries(this.channels).map(async ([name, channel]) => {
      try {
        await channel.stop();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Error stopping ${name}: ${String(err)}`);
      }
    });
    await Promise.allSettled(tasks);
  }

  private async dispatchOutbound(): Promise<void> {
    while (this.dispatching) {
      const msg = await this.bus.consumeOutbound();
      const channel = this.channels[msg.channel];
      if (!channel) {
        continue;
      }
      const sanitizedContent = sanitizeOutboundAssistantContent(msg.content ?? "");
      if (!sanitizedContent.trim() && msg.media.length === 0) {
        continue;
      }

      const outbound =
        sanitizedContent === msg.content
          ? msg
          : {
              ...msg,
              content: sanitizedContent
            };

      try {
        await channel.send(outbound as OutboundMessage);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Error sending to ${msg.channel}: ${String(err)}`);
      }
    }
  }

  getChannel(name: string): BaseChannel<Record<string, unknown>> | undefined {
    return this.channels[name];
  }

  getStatus(): Record<string, { enabled: boolean; running: boolean }> {
    return Object.fromEntries(
      Object.entries(this.channels).map(([name, channel]) => [name, { enabled: true, running: channel.isRunning }])
    );
  }

  get enabledChannels(): string[] {
    return Object.keys(this.channels);
  }
}
