import { evaluateSilentReply } from "@core/features/agent/index.js";
import { isNextclawControlMessage, type MessageBus, type OutboundMessage } from "@core/features/bus/index.js";
import type { Config } from "@core/features/config/index.js";
import type { ExtensionRegistry } from "@core/features/extensions/index.js";
import type { SessionManager } from "@core/features/session/index.js";
import { sanitizeOutboundAssistantContent } from "@core/shared/lib/core-utils/index.js";
import type { BaseChannel } from "@core/features/channels/services/base.js";
import { ExtensionChannelAdapter } from "@core/features/channels/services/extension-channel.service.js";

export class ChannelManager {
  private channels: Record<string, BaseChannel<Record<string, unknown>>> = {};
  private channelConfig: Config | null = null;
  private dispatching = false;
  private dispatchTask: Promise<void> | null = null;
  private extensionChannels: ExtensionRegistry["channels"] = [];

  constructor(
    private readonly deps: {
      bus: MessageBus;
      sessionManager: SessionManager;
    },
  ) {}

  readonly load = (params: {
    channelConfig: Config;
    extensionChannels?: ExtensionRegistry["channels"];
  }): void => {
    this.channelConfig = params.channelConfig;
    this.extensionChannels = params.extensionChannels ?? [];
    this.channels = {};
    this.initChannels();
  };

  readonly reload = async (params: {
    channelConfig: Config;
    extensionChannels?: ExtensionRegistry["channels"];
    start?: boolean;
  }): Promise<void> => {
    await this.stop();
    this.load(params);
    if (params.start === true) {
      await this.start();
    }
  };

  readonly start = async (): Promise<void> => {
    if (!Object.keys(this.channels).length || this.dispatching) {
      return;
    }
    this.dispatching = true;
    this.dispatchTask = this.dispatchOutbound();
    await Promise.allSettled(
      Object.entries(this.channels).map(([name, channel]) => this.startChannel(name, channel)),
    );
  };

  readonly stop = async (): Promise<void> => {
    this.dispatching = false;
    if (this.dispatchTask) {
      await this.deps.bus.publishOutbound({
        channel: "__control__",
        chatId: "",
        content: "",
        media: [],
        metadata: { reason: "shutdown" },
      });
      await this.dispatchTask;
    }
    await Promise.allSettled(
      Object.entries(this.channels).map(async ([name, channel]) => {
        try {
          await channel.stop();
        } catch (error) {
          console.error(`Error stopping ${name}: ${String(error)}`);
        }
      }),
    );
    this.dispatchTask = null;
  };

  readonly status = (): Record<string, { enabled: boolean; running: boolean }> =>
    Object.fromEntries(
      Object.entries(this.channels).map(([name, channel]) => [
        name,
        { enabled: true, running: channel.isRunning },
      ]),
    );

  get enabledChannels(): string[] {
    return Object.keys(this.channels);
  }

  readonly getChannel = (name: string): BaseChannel<Record<string, unknown>> | null =>
    this.channels[name] ?? null;

  readonly deliver = async (message: OutboundMessage): Promise<boolean> => {
    const channel = this.channels[message.channel];
    if (!channel) {
      return false;
    }
    if (isNextclawControlMessage(message)) {
      await channel.handleControlMessage(message);
      return true;
    }
    const outbound = this.normalizeOutbound(message);
    if (!outbound) {
      return true;
    }
    await channel.send(outbound);
    return true;
  };

  private readonly initChannels = (): void => {
    if (!this.channelConfig) {
      return;
    }
    for (const registration of this.extensionChannels) {
      const id = registration.channel.id;
      if (!id) {
        continue;
      }
      if (this.channels[id]) {
        console.warn(`Extension channel ignored because id already exists: ${id}`);
        continue;
      }
      this.channels[id] = new ExtensionChannelAdapter(this.channelConfig, this.deps.bus, registration);
    }
  };

  private readonly startChannel = async (
    name: string,
    channel: BaseChannel<Record<string, unknown>>,
  ): Promise<void> => {
    try {
      await channel.start();
    } catch (error) {
      console.error(`Failed to start channel ${name}: ${String(error)}`);
    }
  };

  private readonly normalizeOutbound = (message: OutboundMessage): OutboundMessage | null => {
    const sanitizedContent = sanitizeOutboundAssistantContent(message.content ?? "");
    const silentReplyDecision = evaluateSilentReply({
      content: sanitizedContent,
      media: message.media,
    });
    if (silentReplyDecision.shouldDrop) {
      return null;
    }
    if (silentReplyDecision.content === message.content) {
      return message;
    }
    return {
      ...message,
      content: silentReplyDecision.content,
    };
  };

  private readonly dispatchOutbound = async (): Promise<void> => {
    while (this.dispatching) {
      const message = await this.deps.bus.consumeOutbound();
      try {
        await this.deliver(message);
      } catch (error) {
        console.error(`Error sending to ${message.channel}: ${String(error)}`);
      }
    }
  };
}
