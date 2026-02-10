import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import { Client, GatewayIntentBits, Partials, type Message as DiscordMessage, type TextBasedChannel } from "discord.js";
import { fetch } from "undici";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { getDataPath } from "../utils/helpers.js";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export class DiscordChannel extends BaseChannel<Config["channels"]["discord"]> {
  name = "discord";
  private client: Client | null = null;
  private typingTasks: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: Config["channels"]["discord"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    if (!this.config.token) {
      throw new Error("Discord token not configured");
    }
    this.running = true;
    this.client = new Client({
      intents: this.config.intents ?? (GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.DirectMessages),
      partials: [Partials.Channel]
    });

    this.client.on("ready", () => {
      // eslint-disable-next-line no-console
      console.log("Discord bot connected");
    });

    this.client.on("messageCreate", async (message) => {
      await this.handleIncoming(message);
    });

    await this.client.login(this.config.token);
  }

  async stop(): Promise<void> {
    this.running = false;
    for (const task of this.typingTasks.values()) {
      clearInterval(task);
    }
    this.typingTasks.clear();
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.client) {
      return;
    }
    const channel = await this.client.channels.fetch(msg.chatId);
    if (!channel || !channel.isTextBased()) {
      return;
    }
    this.stopTyping(msg.chatId);
    const payload: { content: string; reply?: { messageReference: string } } = {
      content: msg.content ?? ""
    };
    if (msg.replyTo) {
      payload.reply = { messageReference: msg.replyTo };
    }
    await (channel as TextBasedChannel).send(payload);
  }

  private async handleIncoming(message: DiscordMessage): Promise<void> {
    if (message.author.bot) {
      return;
    }
    const senderId = message.author.id;
    const channelId = message.channelId;
    if (!this.isAllowed(senderId)) {
      return;
    }
    const contentParts: string[] = [];
    const mediaPaths: string[] = [];
    if (message.content) {
      contentParts.push(message.content);
    }

    if (message.attachments.size) {
      const mediaDir = join(getDataPath(), "media");
      mkdirSync(mediaDir, { recursive: true });
      for (const attachment of message.attachments.values()) {
        if (attachment.size && attachment.size > MAX_ATTACHMENT_BYTES) {
          contentParts.push(`[attachment: ${attachment.name ?? "file"} - too large]`);
          continue;
        }
        try {
          const res = await fetch(attachment.url);
          if (!res.ok) {
            contentParts.push(`[attachment: ${attachment.name ?? "file"} - download failed]`);
            continue;
          }
          const buffer = Buffer.from(await res.arrayBuffer());
          const filename = `${attachment.id}_${(attachment.name ?? "file").replace(/\//g, "_")}`;
          const filePath = join(mediaDir, filename);
          writeFileSync(filePath, buffer);
          mediaPaths.push(filePath);
          contentParts.push(`[attachment: ${filePath}]`);
        } catch {
          contentParts.push(`[attachment: ${attachment.name ?? "file"} - download failed]`);
        }
      }
    }

    const replyTo = message.reference?.messageId ?? null;
    this.startTyping(channelId);

    await this.handleMessage({
      senderId,
      chatId: channelId,
      content: contentParts.length ? contentParts.join("\n") : "[empty message]",
      media: mediaPaths,
      metadata: {
        message_id: message.id,
        guild_id: message.guildId,
        reply_to: replyTo
      }
    });
  }

  private startTyping(channelId: string): void {
    this.stopTyping(channelId);
    if (!this.client) {
      return;
    }
    const channel = this.client.channels.cache.get(channelId);
    if (!channel || !channel.isTextBased()) {
      return;
    }
    const task = setInterval(() => {
      void (channel as TextBasedChannel).sendTyping();
    }, 8000);
    this.typingTasks.set(channelId, task);
  }

  private stopTyping(channelId: string): void {
    const task = this.typingTasks.get(channelId);
    if (task) {
      clearInterval(task);
      this.typingTasks.delete(channelId);
    }
  }
}
