import type { BusChannelMessageBus, BusChannelRuntime } from "@nextclaw/extension-sdk";
import {
  Bot,
  ReceiverMode,
  SessionEvents,
  type GroupMessageEvent,
  type PrivateMessageEvent
} from "qq-official-bot";

export type QQChannelConfig = { appId?: string; secret?: string; allowFrom?: string[] };

type QQMessageEvent = PrivateMessageEvent | GroupMessageEvent;
type QQMessageType = "private" | "group";
type QQRawUser = Partial<Record<
  "id" | "user_id" | "user_openid" | "member_openid" | "username" | "user_name" | "nickname" | "nick" | "card",
  string
>>;
type QQRawEvent = { author?: QQRawUser; sender?: QQRawUser; group_openid?: string };
type QQIncomingIdentity = { messageId: string; rawEvent: QQRawEvent; senderId: string };
type QQIncomingRoute = { chatId: string; metadata: Record<string, unknown> };

export class QQChannel {
  name = "qq";
  protected running = false;
  private bot: Bot | null = null;
  private processedIds: string[] = [];
  private processedSet: Set<string> = new Set();
  private senderNameCache: Map<string, string> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTask: Promise<void> | null = null;
  private reconnectAttempt = 0;
  private readonly reconnectBaseMs = 1000;
  private readonly reconnectMaxMs = 60000;
  protected readonly connectTimeoutMs: number = 90000;

  constructor(private readonly config: QQChannelConfig, private readonly bus: BusChannelMessageBus) {}

  start = async (): Promise<void> => {
    if (!this.config.appId || !this.config.secret) {
      this.running = false;
      throw new Error("QQ appId/appSecret not configured");
    }

    this.running = true;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    this.tryConnect("startup");
    await this.connectTask;
  };

  stop = async (): Promise<void> => {
    this.running = false;
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;
    await this.teardownBot();
    if (this.connectTask) {
      await this.connectTask;
    }
  };

  send: BusChannelRuntime["send"] = async (msg) => {
    if (!this.bot) {
      return;
    }

    const qqMeta = (msg.metadata?.qq as Record<string, unknown> | undefined) ?? {};
    const messageType = (qqMeta.messageType as QQMessageType | undefined) ?? "private";
    const replyTo = msg.replyTo ?? (msg.metadata?.message_id as string | undefined);
    const source = replyTo ? { id: replyTo } : undefined;
    const rawContent = msg.content;

    try {
      await this.sendByMessageType({ messageType, qqMeta, msg, payload: rawContent, source });
    } catch (error) {
      if (!this.isDisallowedUrlParamError(error)) {
        throw error;
      }
      const safeText = this.toQqSafeText(rawContent, error);
      await this.sendByMessageType({ messageType, qqMeta, msg, payload: safeText, source });
    }
  };

  private sendByMessageType = async (params: {
    messageType: QQMessageType;
    qqMeta: Record<string, unknown>;
    msg: Parameters<BusChannelRuntime["send"]>[0];
    payload: unknown;
    source: { id: string } | undefined;
  }): Promise<void> => {
    const { messageType, qqMeta, msg, payload, source } = params;
    if (messageType === "group") {
      const groupId = (qqMeta.groupId as string | undefined) ?? msg.chatId;
      await this.sendWithTokenRetry(() => this.bot?.sendGroupMessage(groupId, payload, source));
      return;
    }

    const userId = (qqMeta.userId as string | undefined) ?? msg.chatId;
    await this.sendWithTokenRetry(() => this.bot?.sendPrivateMessage(userId, payload, source));
  };

  private handleIncoming = async (event: QQMessageEvent): Promise<void> => {
    const identity = this.resolveIncomingIdentity(event);
    if (!identity) {
      return;
    }
    const content = event.raw_message?.trim() || "[empty message]";
    const senderName = this.resolveIncomingSenderName(identity.senderId, identity.rawEvent, content);
    const route = this.resolveIncomingRoute(event, identity.rawEvent, identity.senderId, senderName);
    if (!route.chatId || !this.isAllowed(identity.senderId)) {
      return;
    }
    await this.bus.publishInbound({
      channel: this.name,
      senderId: identity.senderId,
      chatId: route.chatId,
      content: this.decorateSpeakerPrefix({
        content,
        senderId: identity.senderId,
        senderName
      }),
      metadata: {
        message_id: identity.messageId,
        qq: route.metadata
      }
    });
  };

  private resolveIncomingIdentity = (event: QQMessageEvent): QQIncomingIdentity | null => {
    const messageId = event.message_id || event.id || "";
    if (messageId && this.isDuplicate(messageId)) {
      return null;
    }
    const rawEvent = event as unknown as QQRawEvent;
    if (this.isSelfEvent(event)) {
      return null;
    }
    const senderId = this.resolveSenderId(event, rawEvent);
    return senderId ? { messageId, rawEvent, senderId } : null;
  };

  private resolveIncomingSenderName = (senderId: string, rawEvent: QQRawEvent, content: string): string | null => {
    const eventSenderName = this.resolveSenderName(rawEvent);
    if (eventSenderName) {
      this.senderNameCache.set(senderId, eventSenderName);
    }
    const declaredName = this.extractDeclaredName(content);
    if (declaredName) {
      this.senderNameCache.set(senderId, declaredName);
    }
    return declaredName ?? eventSenderName ?? this.senderNameCache.get(senderId) ?? null;
  };

  private resolveIncomingRoute = (
    event: QQMessageEvent,
    rawEvent: QQRawEvent,
    senderId: string,
    senderName: string | null,
  ): QQIncomingRoute => {
    let chatId = senderId;
    let messageType: QQMessageType = "private";
    const qqMeta: Record<string, unknown> = { userId: senderId };
    if (senderName) {
      qqMeta.userName = senderName;
    }

    if (event.message_type === "group") {
      messageType = "group";
      const groupId = event.group_id || rawEvent.group_openid || "";
      chatId = groupId;
      qqMeta.groupId = groupId;
    }

    qqMeta.messageType = messageType;
    return { chatId, metadata: qqMeta };
  };

  private isAllowed = (senderId: string): boolean => {
    const allowList = this.config.allowFrom ?? [];
    if (!allowList.length || allowList.includes(senderId)) {
      return true;
    }
    return senderId.includes("|") && senderId.split("|").some((part) => allowList.includes(part));
  };

  private isSelfEvent = (event: QQMessageEvent): boolean => {
    const userId = typeof event.user_id === "string" ? event.user_id : "";
    const selfId = typeof event.self_id === "string" ? event.self_id : "";
    return Boolean(userId && selfId && userId === selfId);
  };

  private resolveSenderId = (event: QQMessageEvent, rawEvent: QQRawEvent): string => {
    return this.readFirstString([
      event.user_id,
      rawEvent.sender?.member_openid,
      rawEvent.sender?.user_openid,
      rawEvent.sender?.user_id,
      rawEvent.author?.member_openid,
      rawEvent.author?.user_openid,
      rawEvent.author?.id
    ]) ?? "";
  };

  private resolveSenderName = (rawEvent: QQRawEvent): string | null => {
    return this.readFirstString([
      rawEvent.sender?.card,
      rawEvent.sender?.nickname,
      rawEvent.sender?.nick,
      rawEvent.sender?.username,
      rawEvent.sender?.user_name,
      rawEvent.author?.username
    ]);
  };

  private readFirstString = (values: unknown[]): string | null => {
    for (const value of values) {
      if (typeof value !== "string") {
        continue;
      }
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
    }
    return null;
  };

  private decorateSpeakerPrefix = (params: {
    content: string;
    senderId: string;
    senderName: string | null;
  }): string => {
    const { content, senderId, senderName } = params;
    // Always inject sender identity so both group and private QQ sessions can resolve user identity.
    const userId = this.sanitizeSpeakerToken(senderId);
    if (!userId) {
      return content;
    }
    const name = this.sanitizeSpeakerToken(senderName ?? "");
    const speakerFields = [`user_id=${userId}`];
    if (name) {
      speakerFields.push(`name=${name}`);
    }
    return `[speaker:${speakerFields.join(";")}] ${content}`;
  };

  private sanitizeSpeakerToken = (value: string): string => {
    return value.replace(/[\r\n;\]]/g, " ").trim();
  };

  private extractDeclaredName = (content: string): string | null => {
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
  };

  private isDuplicate = (messageId: string): boolean => {
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
  };

  private sendWithTokenRetry = async (send: () => Promise<unknown> | undefined): Promise<void> => {
    try {
      await send();
    } catch (error) {
      if (!this.isTokenExpiredError(error) || !this.bot) {
        throw error;
      }
      await this.bot.sessionManager.getAccessToken();
      await send();
    }
  };

  private isTokenExpiredError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("code(11244)") || message.toLowerCase().includes("token not exist or expire");
  };

  private isDisallowedUrlParamError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("code(40034028)") || message.includes("请求参数不允许包含url");
  };

  private toQqSafeText = (content: string, error: unknown): string => {
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
  };

  private extractBlockedUrlToken = (error: unknown): string | null => {
    const message = error instanceof Error ? error.message : String(error);
    const match = message.match(/包含url\s+([^\s]+)/);
    if (!match) {
      return null;
    }
    const token = match[1].trim();
    return token.length > 0 ? token : null;
  };

  private tryConnect = (trigger: string): void => {
    if (!this.running || this.bot || this.connectTask) {
      return;
    }
    this.connectTask = this.connect(trigger).finally(() => {
      this.connectTask = null;
    });
  };

  private connect = async (trigger: string): Promise<void> => {
    let candidate: Bot | null = null;
    try {
      candidate = this.createBot();
      await this.startBotWithTimeout(candidate);
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
  };

  protected createBot = (): Bot => {
    const bot = new Bot({
      appid: this.config.appId!,
      secret: this.config.secret!,
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
  };

  private handleSessionDead = async (bot: Bot): Promise<void> => {
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
  };

  private scheduleReconnect = (delayMs: number, trigger: string): void => {
    if (!this.running) {
      return;
    }
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.tryConnect(trigger);
    }, delayMs);
  };

  private clearReconnectTimer = (): void => {
    if (!this.reconnectTimer) {
      return;
    }
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  };

  private teardownBot = async (): Promise<void> => {
    if (!this.bot) {
      return;
    }
    const bot = this.bot;
    this.bot = null;
    await this.safeStopBot(bot);
  };

  private safeStopBot = async (bot: Bot): Promise<void> => {
    bot.removeAllListeners("message.private");
    bot.removeAllListeners("message.group");
    bot.sessionManager.removeAllListeners(SessionEvents.DEAD);
    try {
      await bot.stop();
    } catch {
      // ignore cleanup errors
    }
  };

  private startBotWithTimeout = async (bot: Bot): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        bot.start(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`QQ bot start timed out after ${this.connectTimeoutMs}ms`)), this.connectTimeoutMs);
        })
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  };

  get isRunning(): boolean {
    return this.bot !== null;
  }

  private getBackoffDelayMs = (attempt: number): number => {
    const jitter = Math.floor(Math.random() * 500);
    const exp = Math.min(this.reconnectMaxMs, this.reconnectBaseMs * 2 ** Math.max(0, attempt - 1));
    return Math.min(this.reconnectMaxMs, exp + jitter);
  };

  private formatError = (error: unknown): string => {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }
    return String(error);
  };
}
