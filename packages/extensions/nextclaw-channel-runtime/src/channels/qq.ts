import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import {
  Bot,
  ReceiverMode,
  SessionEvents,
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
  private senderNameCache: Map<string, string> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTask: Promise<void> | null = null;
  private reconnectAttempt = 0;
  private readonly reconnectBaseMs = 1000;
  private readonly reconnectMaxMs = 60000;

  constructor(config: Config["channels"]["qq"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    if (!this.config.appId || !this.config.secret) {
      this.running = false;
      throw new Error("QQ appId/appSecret not configured");
    }

    this.running = true;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.tryConnect("startup");
  }

  async stop(): Promise<void> {
    this.running = false;
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;
    await this.teardownBot();
    if (this.connectTask) {
      await this.connectTask;
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
    const rawContent = msg.content ?? "";
    const payload = rawContent;

    try {
      await this.sendByMessageType({ messageType, qqMeta, msg, payload, source });
    } catch (error) {
      if (!this.isDisallowedUrlParamError(error)) {
        throw error;
      }
      const safeText = this.toQqSafeText(rawContent, error);
      await this.sendByMessageType({ messageType, qqMeta, msg, payload: safeText, source });
    }
  }

  private async sendByMessageType(params: {
    messageType: QQMessageType;
    qqMeta: Record<string, unknown>;
    msg: OutboundMessage;
    payload: unknown;
    source: { id: string } | undefined;
  }): Promise<void> {
    const { messageType, qqMeta, msg, payload, source } = params;
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
      sender?: {
        user_openid?: string;
        member_openid?: string;
        user_id?: string;
        nickname?: string;
        nick?: string;
        card?: string;
        username?: string;
        user_name?: string;
      };
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
    const normalizedContent = content || "[empty message]";
    const eventSenderName = this.resolveSenderName(rawEvent);
    if (eventSenderName) {
      this.senderNameCache.set(senderId, eventSenderName);
    }
    const declaredName = this.extractDeclaredName(normalizedContent);
    if (declaredName) {
      this.senderNameCache.set(senderId, declaredName);
    }
    const senderName = declaredName ?? eventSenderName ?? this.senderNameCache.get(senderId) ?? null;

    let chatId = senderId;
    let messageType: QQMessageType = "private";
    const qqMeta: Record<string, unknown> = {};

    if (event.message_type === "group") {
      messageType = "group";
      const groupId = event.group_id || rawEvent.group_openid || "";
      chatId = groupId;
      qqMeta.groupId = groupId;
      qqMeta.userId = senderId;
      if (senderName) {
        qqMeta.userName = senderName;
      }
    } else if (event.message_type === "guild") {
      messageType = "guild";
      chatId = event.channel_id ?? "";
      qqMeta.guildId = event.guild_id;
      qqMeta.channelId = event.channel_id;
      qqMeta.userId = senderId;
      if (senderName) {
        qqMeta.userName = senderName;
      }
    } else if (event.sub_type === "direct") {
      messageType = "direct";
      chatId = event.guild_id ?? "";
      qqMeta.guildId = event.guild_id;
      qqMeta.userId = senderId;
      if (senderName) {
        qqMeta.userName = senderName;
      }
    } else {
      qqMeta.userId = senderId;
      if (senderName) {
        qqMeta.userName = senderName;
      }
    }

    qqMeta.messageType = messageType;

    const safeContent = this.decorateSpeakerPrefix({
      content: normalizedContent,
      messageType,
      senderId,
      senderName
    });

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
      attachments: [],
      metadata: {
        message_id: messageId,
        qq: qqMeta
      }
    });
  }

  private resolveSenderName(rawEvent: {
    sender?: {
      nickname?: string;
      nick?: string;
      card?: string;
      username?: string;
      user_name?: string;
    };
  }): string | null {
    const candidates = [
      rawEvent.sender?.card,
      rawEvent.sender?.nickname,
      rawEvent.sender?.nick,
      rawEvent.sender?.username,
      rawEvent.sender?.user_name
    ];
    for (const value of candidates) {
      if (typeof value !== "string") {
        continue;
      }
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  private decorateSpeakerPrefix(params: {
    content: string;
    messageType: QQMessageType;
    senderId: string;
    senderName: string | null;
  }): string {
    // Always inject sender identity so both group and private QQ sessions can resolve user identity.
    const userId = this.sanitizeSpeakerToken(params.senderId);
    if (!userId) {
      return params.content;
    }
    const name = this.sanitizeSpeakerToken(params.senderName ?? "");
    const speakerFields = [`user_id=${userId}`];
    if (name) {
      speakerFields.push(`name=${name}`);
    }
    return `[speaker:${speakerFields.join(";")}] ${params.content}`;
  }

  private sanitizeSpeakerToken(value: string): string {
    return value.replace(/[\r\n;\]]/g, " ").trim();
  }

  private extractDeclaredName(content: string): string | null {
    const trimmed = content.trim();
    const patterns = [
      /^我的昵称是\s*([^\s，。！？!?,]{1,24})$/u,
      /^我叫\s*([^\s，。！？!?,]{1,24})$/u,
      /^叫我\s*([^\s，。！？!?,]{1,24})$/u
    ];
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (!match) {
        continue;
      }
      const candidate = this.sanitizeSpeakerToken(match[1] ?? "");
      if (candidate) {
        return candidate;
      }
    }
    return null;
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

  private isDisallowedUrlParamError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("code(40034028)") || message.includes("请求参数不允许包含url");
  }

  private toQqSafeText(content: string, error: unknown): string {
    let safe = content
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      .replace(/https?:\/\/\S+/gi, "[link]")
      .replace(/www\.\S+/gi, "[link]")
      .replace(/\b[a-z0-9._/-]+\.md\b/gi, "[file]");

    const blocked = this.extractBlockedUrlToken(error);
    if (blocked) {
      safe = safe.replaceAll(blocked, "[link]");
    }
    return safe;
  }

  private extractBlockedUrlToken(error: unknown): string | null {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/包含url\s+([^\s]+)/);
    if (!match) {
      return null;
    }
    const token = match[1].trim();
    return token.length > 0 ? token : null;
  }

  private tryConnect(trigger: string): void {
    if (!this.running || this.bot || this.connectTask) {
      return;
    }
    this.connectTask = this.connect(trigger).finally(() => {
      this.connectTask = null;
    });
  }

  private async connect(trigger: string): Promise<void> {
    let candidate: Bot | null = null;
    try {
      candidate = this.createBot();
      await candidate.start();
      if (!this.running) {
        await this.safeStopBot(candidate);
        return;
      }
      this.bot = candidate;
      this.reconnectAttempt = 0;
      // eslint-disable-next-line no-console
      console.log("QQ bot connected");
    } catch (error) {
      if (candidate) {
        await this.safeStopBot(candidate);
      }
      if (!this.running) {
        return;
      }
      this.reconnectAttempt += 1;
      const delayMs = this.getBackoffDelayMs(this.reconnectAttempt);
      // eslint-disable-next-line no-console
      console.error(
        `[qq] start failed (${trigger}, attempt ${this.reconnectAttempt}), retry in ${delayMs}ms: ${this.formatError(error)}`
      );
      this.scheduleReconnect(delayMs, `${trigger}-retry`);
    }
  }

  private createBot(): Bot {
    const bot = new Bot({
      appid: this.config.appId,
      secret: this.config.secret,
      mode: ReceiverMode.WEBSOCKET,
      intents: ["C2C_MESSAGE_CREATE", "GROUP_AT_MESSAGE_CREATE"],
      removeAt: true,
      logLevel: "info"
    });

    bot.on("message.private", async (event) => {
      await this.handleIncoming(event);
    });

    bot.on("message.group", async (event) => {
      await this.handleIncoming(event);
    });

    bot.sessionManager.on(SessionEvents.DEAD, () => {
      void this.handleSessionDead(bot);
    });

    return bot;
  }

  private async handleSessionDead(bot: Bot): Promise<void> {
    if (!this.running || this.bot !== bot) {
      return;
    }
    this.bot = null;
    await this.safeStopBot(bot);
    this.reconnectAttempt += 1;
    const delayMs = this.getBackoffDelayMs(this.reconnectAttempt);
    // eslint-disable-next-line no-console
    console.error(`[qq] session dead, reconnect in ${delayMs}ms`);
    this.scheduleReconnect(delayMs, "session-dead");
  }

  private scheduleReconnect(delayMs: number, trigger: string): void {
    if (!this.running) {
      return;
    }
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.tryConnect(trigger);
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private async teardownBot(): Promise<void> {
    if (!this.bot) {
      return;
    }
    const bot = this.bot;
    this.bot = null;
    await this.safeStopBot(bot);
  }

  private async safeStopBot(bot: Bot): Promise<void> {
    bot.removeAllListeners("message.private");
    bot.removeAllListeners("message.group");
    bot.sessionManager.removeAllListeners(SessionEvents.DEAD);
    try {
      await bot.stop();
    } catch {
      // ignore cleanup errors
    }
  }

  private getBackoffDelayMs(attempt: number): number {
    const jitter = Math.floor(Math.random() * 500);
    const exp = Math.min(this.reconnectMaxMs, this.reconnectBaseMs * 2 ** Math.max(0, attempt - 1));
    return Math.min(this.reconnectMaxMs, exp + jitter);
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }
    return String(error);
  }
}
