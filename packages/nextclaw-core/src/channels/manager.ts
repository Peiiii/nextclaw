import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import type { BaseChannel } from "./base.js";
import type { SessionManager } from "../session/manager.js";
import { sanitizeOutboundAssistantContent } from "../utils/reasoning-tags.js";
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
      const nextclawRuntime = registration.channel.nextclaw;
      if (nextclawRuntime?.createChannel) {
        const enabled = nextclawRuntime.isEnabled ? nextclawRuntime.isEnabled(this.config) : true;
        if (!enabled) {
          continue;
        }
        this.channels[id] = nextclawRuntime.createChannel({
          config: this.config,
          bus: this.bus,
          sessionManager: this.sessionManager
        });
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

  private normalizeOutbound(msg: OutboundMessage): OutboundMessage | null {
    const sanitizedContent = sanitizeOutboundAssistantContent(msg.content ?? "");
    if (!sanitizedContent.trim() && msg.media.length === 0) {
      return null;
    }
    if (sanitizedContent === msg.content) {
      return msg;
    }
    return {
      ...msg,
      content: sanitizedContent
    };
  }

  async deliver(msg: OutboundMessage): Promise<boolean> {
    const outbound = this.normalizeOutbound(msg);
    if (!outbound) {
      return true;
    }
    const channel = this.channels[outbound.channel];
    if (!channel) {
      return false;
    }
    await channel.send(outbound);
    return true;
  }

  private async dispatchOutbound(): Promise<void> {
    while (this.dispatching) {
      const msg = await this.bus.consumeOutbound();
      try {
        await this.deliver(msg);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`Error sending to ${msg.channel}: ${String(err)}`);
      }
    }
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
