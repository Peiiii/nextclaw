import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import {
  Bot,
  ReceiverMode,
  segment,
  type GroupMessageEvent,
  type GuildMessageEvent,
  type PrivateMessageEvent
} from "qq-official-bot";

type QQMessageEvent = PrivateMessageEvent | GroupMessageEvent | GuildMessageEvent;
type QQMessageType = "private" | "group" | "direct" | "guild";

export class QQChannel extends BaseChannel<Config["channels"]["qq"]> {
  name = "qq";
  private bot: Bot | null = null;
  private processedIds: string[] = [];
  private processedSet: Set<string> = new Set();

  constructor(config: Config["channels"]["qq"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.appId || !this.config.secret) {
      throw new Error("QQ appId/appSecret not configured");
    }

    this.bot = new Bot({
      appid: this.config.appId,
      secret: this.config.secret,
      mode: ReceiverMode.WEBSOCKET,
      intents: ["C2C_MESSAGE_CREATE", "GROUP_AT_MESSAGE_CREATE"],
      removeAt: true,
      logLevel: "info"
    });

    this.bot.on("message.private", async (event) => {
      await this.handleIncoming(event);
    });

    this.bot.on("message.group", async (event) => {
      await this.handleIncoming(event);
    });

    await this.bot.start();
    // eslint-disable-next-line no-console
    console.log("QQ bot connected");
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.bot) {
      this.bot.removeAllListeners("message.private");
      this.bot.removeAllListeners("message.group");
      await this.bot.stop();
      this.bot = null;
    }
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.bot) {
      return;
    }

    const qqMeta = (msg.metadata?.qq as Record<string, unknown> | undefined) ?? {};
    const messageType = (qqMeta.messageType as QQMessageType | undefined) ?? "private";
    const metadataMessageId = (msg.metadata?.message_id as string | undefined) ?? null;
    const sourceId = msg.replyTo ?? metadataMessageId ?? undefined;
    const source = sourceId ? { id: sourceId } : undefined;
    const content = this.normalizeContent(msg.content ?? "");
    const payload = this.config.markdownSupport ? segment.markdown(content) : content;

    if (messageType === "group") {
      const groupId = (qqMeta.groupId as string | undefined) ?? msg.chatId;
      await this.sendWithTokenRetry(() => this.bot?.sendGroupMessage(groupId, payload, source));
      return;
    }

    if (messageType === "direct") {
      const guildId = (qqMeta.guildId as string | undefined) ?? msg.chatId;
      await this.sendWithTokenRetry(() => this.bot?.sendDirectMessage(guildId, payload, source));
      return;
    }

    if (messageType === "guild") {
      const channelId = (qqMeta.channelId as string | undefined) ?? msg.chatId;
      await this.sendWithTokenRetry(() => this.bot?.sendGuildMessage(channelId, payload, source));
      return;
    }

    const userId = (qqMeta.userId as string | undefined) ?? msg.chatId;
    await this.sendWithTokenRetry(() => this.bot?.sendPrivateMessage(userId, payload, source));
  }

  private async handleIncoming(event: QQMessageEvent): Promise<void> {
    const messageId = event.message_id || event.id || "";
    if (messageId && this.isDuplicate(messageId)) {
      return;
    }

    if (event.user_id === event.self_id) {
      return;
    }

    const rawEvent = event as unknown as {
      sender?: { user_openid?: string; member_openid?: string; user_id?: string };
      group_openid?: string;
    };
    const senderId =
      event.user_id ||
      rawEvent.sender?.member_openid ||
      rawEvent.sender?.user_openid ||
      rawEvent.sender?.user_id ||
      "";
    if (!senderId) {
      return;
    }

    const content = event.raw_message?.trim() ?? "";
    const safeContent = content || "[empty message]";

    let chatId = senderId;
    let messageType: QQMessageType = "private";
    const qqMeta: Record<string, unknown> = {};

    if (event.message_type === "group") {
      messageType = "group";
      const groupId = event.group_id || rawEvent.group_openid || "";
      chatId = groupId;
      qqMeta.groupId = groupId;
      qqMeta.userId = senderId;
    } else if (event.message_type === "guild") {
      messageType = "guild";
      chatId = event.channel_id ?? "";
      qqMeta.guildId = event.guild_id;
      qqMeta.channelId = event.channel_id;
      qqMeta.userId = senderId;
    } else if (event.sub_type === "direct") {
      messageType = "direct";
      chatId = event.guild_id ?? "";
      qqMeta.guildId = event.guild_id;
      qqMeta.userId = senderId;
    } else {
      qqMeta.userId = senderId;
    }

    qqMeta.messageType = messageType;

    if (!chatId) {
      return;
    }

    if (!this.isAllowed(senderId)) {
      return;
    }

    await this.handleMessage({
      senderId,
      chatId,
      content: safeContent,
      media: [],
      metadata: {
        message_id: messageId,
        qq: qqMeta
      }
    });
  }

  private isDuplicate(messageId: string): boolean {
    if (this.processedSet.has(messageId)) {
      return true;
    }
    this.processedSet.add(messageId);
    this.processedIds.push(messageId);
    if (this.processedIds.length > 1000) {
      const removed = this.processedIds.splice(0, 500);
      for (const id of removed) {
        this.processedSet.delete(id);
      }
    }
    return false;
  }

  private normalizeContent(content: string): string {
    const withoutThink = content.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<\/?think>/gi, "");
    const cleaned = withoutThink.trim();
    return cleaned || "[empty message]";
  }

  private async sendWithTokenRetry(send: () => Promise<unknown> | undefined): Promise<void> {
    try {
      await send();
    } catch (error) {
      if (!this.isTokenExpiredError(error) || !this.bot) {
        throw error;
      }
      await this.bot.sessionManager.getAccessToken();
      await send();
    }
  }

  private isTokenExpiredError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("code(11244)") || message.toLowerCase().includes("token not exist or expire");
  }
}
