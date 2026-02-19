import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { InboundAttachment, InboundAttachmentErrorCode, OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import {
  Client,
  GatewayIntentBits,
  Partials,
  MessageFlags,
  type Message as DiscordMessage,
  type Attachment,
  type TextBasedChannel,
  type TextBasedChannelFields
} from "discord.js";
import { ProxyAgent, fetch } from "undici";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { getDataPath } from "../utils/helpers.js";

const DEFAULT_MEDIA_MAX_MB = 8;
const MEDIA_FETCH_TIMEOUT_MS = 15000;

type AttachmentIssue = {
  id?: string;
  name?: string;
  url?: string;
  code: InboundAttachmentErrorCode;
  message: string;
};

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
    const textChannel = channel as TextBasedChannel & TextBasedChannelFields;
    const payload: {
      content: string;
      reply?: { messageReference: string };
      flags?: number;
    } = {
      content: msg.content ?? ""
    };
    if (msg.replyTo) {
      payload.reply = { messageReference: msg.replyTo };
    }
    if (msg.metadata?.silent === true) {
      payload.flags = MessageFlags.SuppressNotifications;
    }
    await textChannel.send(payload as unknown as Parameters<TextBasedChannelFields["send"]>[0]);
  }

  private async handleIncoming(message: DiscordMessage): Promise<void> {
    const selfUserId = this.client?.user?.id;
    if (selfUserId && message.author.id === selfUserId) {
      return;
    }
    if (message.author.bot && !this.config.allowBots) {
      return;
    }
    const senderId = message.author.id;
    const channelId = message.channelId;
    if (!this.isAllowed(senderId)) {
      return;
    }

    const contentParts: string[] = [];
    const attachments: InboundAttachment[] = [];
    const attachmentIssues: AttachmentIssue[] = [];

    if (message.content) {
      contentParts.push(message.content);
    }

    if (message.attachments.size) {
      const mediaDir = join(getDataPath(), "media");
      mkdirSync(mediaDir, { recursive: true });
      const maxBytes = Math.max(1, this.config.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB) * 1024 * 1024;
      const proxy = this.resolveProxyAgent();
      for (const attachment of message.attachments.values()) {
        const resolved = await this.resolveInboundAttachment({
          attachment,
          mediaDir,
          maxBytes,
          proxy
        });
        if (resolved.attachment) {
          attachments.push(resolved.attachment);
        }
        if (resolved.issue) {
          attachmentIssues.push(resolved.issue);
        }
      }

      if (!message.content && attachments.length > 0) {
        contentParts.push(buildAttachmentSummary(attachments));
      }
    }

    const replyTo = message.reference?.messageId ?? null;
    this.startTyping(channelId);

    await this.handleMessage({
      senderId,
      chatId: channelId,
      content: contentParts.length ? contentParts.join("\n") : "[empty message]",
      attachments,
      metadata: {
        message_id: message.id,
        guild_id: message.guildId,
        reply_to: replyTo,
        ...(attachmentIssues.length ? { attachment_issues: attachmentIssues } : {})
      }
    });
  }

  private resolveProxyAgent(): ProxyAgent | null {
    const proxy = this.config.proxy?.trim();
    if (!proxy) {
      return null;
    }
    try {
      return new ProxyAgent(proxy);
    } catch {
      return null;
    }
  }

  private async resolveInboundAttachment(params: {
    attachment: Attachment;
    mediaDir: string;
    maxBytes: number;
    proxy: ProxyAgent | null;
  }): Promise<{ attachment?: InboundAttachment; issue?: AttachmentIssue }> {
    const { attachment, mediaDir, maxBytes, proxy } = params;
    const id = attachment.id;
    const name = attachment.name ?? "file";
    const url = attachment.url;
    const mimeType = attachment.contentType ?? guessMimeFromName(name) ?? undefined;

    if (!url) {
      return {
        issue: {
          id,
          name,
          code: "invalid_payload",
          message: "attachment URL missing"
        }
      };
    }

    if (attachment.size && attachment.size > maxBytes) {
      return {
        attachment: {
          id,
          name,
          url,
          mimeType,
          size: attachment.size,
          source: "discord",
          status: "remote-only",
          errorCode: "too_large"
        },
        issue: {
          id,
          name,
          url,
          code: "too_large",
          message: `attachment size ${attachment.size} exceeds ${maxBytes}`
        }
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MEDIA_FETCH_TIMEOUT_MS);

    try {
      const fetchInit = {
        signal: controller.signal,
        ...(proxy ? { dispatcher: proxy } : {})
      };
      const res = await fetch(url, fetchInit as RequestInit);
      if (!res.ok) {
        return {
          attachment: {
            id,
            name,
            url,
            mimeType,
            size: attachment.size,
            source: "discord",
            status: "remote-only",
            errorCode: "http_error"
          },
          issue: {
            id,
            name,
            url,
            code: "http_error",
            message: `HTTP ${res.status}`
          }
        };
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > maxBytes) {
        return {
          attachment: {
            id,
            name,
            url,
            mimeType,
            size: buffer.length,
            source: "discord",
            status: "remote-only",
            errorCode: "too_large"
          },
          issue: {
            id,
            name,
            url,
            code: "too_large",
            message: `downloaded payload ${buffer.length} exceeds ${maxBytes}`
          }
        };
      }

      const filename = `${id}_${sanitizeAttachmentName(name)}`;
      const filePath = join(mediaDir, filename);
      writeFileSync(filePath, buffer);
      return {
        attachment: {
          id,
          name,
          path: filePath,
          url,
          mimeType,
          size: buffer.length,
          source: "discord",
          status: "ready"
        }
      };
    } catch (err) {
      return {
        attachment: {
          id,
          name,
          url,
          mimeType,
          size: attachment.size,
          source: "discord",
          status: "remote-only",
          errorCode: "download_failed"
        },
        issue: {
          id,
          name,
          url,
          code: "download_failed",
          message: String(err)
        }
      };
    } finally {
      clearTimeout(timeoutId);
    }
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
    const textChannel = channel as TextBasedChannel & TextBasedChannelFields;
    const task = setInterval(() => {
      void textChannel.sendTyping();
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

function sanitizeAttachmentName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

function guessMimeFromName(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "image/tiff";
  return null;
}

function isImageAttachment(attachment: InboundAttachment): boolean {
  if (attachment.mimeType?.startsWith("image/")) {
    return true;
  }
  return Boolean(attachment.name && guessMimeFromName(attachment.name));
}

function buildAttachmentSummary(attachments: InboundAttachment[]): string {
  const count = attachments.length;
  if (count === 0) {
    return "";
  }
  const allImages = attachments.every((entry) => isImageAttachment(entry));
  if (allImages) {
    return `<media:image> (${count} ${count === 1 ? "image" : "images"})`;
  }
  return `<media:document> (${count} ${count === 1 ? "file" : "files"})`;
}
