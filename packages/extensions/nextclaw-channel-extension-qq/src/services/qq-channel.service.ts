import {
  DIAGNOSTIC_CORRELATION_METADATA_KEY,
  classifyDiagnosticError,
  type BusChannelMessageBus,
  type BusChannelRuntime,
  type ExtensionDiagnostics,
} from "@nextclaw/extension-sdk";
import {
  Bot,
  ReceiverMode,
  SessionEvents,
  type GroupMessageEvent,
  type PrivateMessageEvent
} from "qq-official-bot";
import {
  QQGatewaySessionLimitError,
  QQGatewayStartupProbeService
} from "./qq-gateway-startup-probe.service.js";
import { QQDiagnosticsService } from "./qq-diagnostics.service.js";
import { QQOutboundDeliveryService } from "./qq-outbound-delivery.service.js";

export type QQChannelConfig = { appId?: string; secret?: string; allowFrom?: string[] };

type QQBot = Bot<ReceiverMode.WEBSOCKET>;
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
  private bot: QQBot | null = null;
  private processedIds: string[] = [];
  private processedSet: Set<string> = new Set();
  private processingSet: Set<string> = new Set();
  private senderNameCache: Map<string, string> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTask: Promise<void> | null = null;
  private reconnectAttempt = 0;
  private connectionGeneration = 0;
  private readonly diagnostics: QQDiagnosticsService;
  private readonly outboundDelivery: QQOutboundDeliveryService;
  private readonly reconnectBaseMs = 1000;
  private readonly reconnectMaxMs = 60000;
  protected readonly connectTimeoutMs: number = 90000;

  constructor(
    private readonly config: QQChannelConfig,
    private readonly bus: BusChannelMessageBus,
    diagnostics?: ExtensionDiagnostics,
  ) {
    this.diagnostics = new QQDiagnosticsService(diagnostics);
    this.outboundDelivery = new QQOutboundDeliveryService(() => this.bot, this.diagnostics);
  }

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

  send: BusChannelRuntime["send"] = async (msg) => this.outboundDelivery.send(msg);

  private handleIncoming = async (event: QQMessageEvent): Promise<void> => {
    const correlationId = this.createInboundCorrelationId(event);
    if (this.isSelfEvent(event)) {
      await this.diagnostics.emitInboundRejected(correlationId, "self");
      return;
    }
    const identity = this.resolveIncomingIdentity(event);
    if (!identity) {
      await this.diagnostics.emitInboundRejected(correlationId, "identity_missing");
      return;
    }
    await this.diagnostics.emit({
      domain: "channel.delivery",
      event: "inbound.observed",
      component: "extension.qq",
      outcome: "observed",
      correlationId,
      facts: { channel: this.name, direction: "inbound", stage: "extension" },
    });
    const content = event.raw_message?.trim() || "[empty message]";
    const senderName = this.resolveIncomingSenderName(identity.senderId, identity.rawEvent, content);
    const route = this.resolveIncomingRoute(event, identity.rawEvent, identity.senderId, senderName);
    if (!route.chatId) {
      await this.diagnostics.emitInboundRejected(correlationId, "route_missing");
      return;
    }
    if (!this.isAllowed(identity.senderId)) {
      await this.diagnostics.emitInboundRejected(correlationId, "allowlist");
      return;
    }
    if (!this.beginIncoming(identity.messageId)) {
      await this.diagnostics.emitInboundRejected(correlationId, "duplicate");
      return;
    }
    await this.diagnostics.emit({
      domain: "channel.delivery",
      event: "inbound.submit.started",
      component: "extension.qq",
      outcome: "started",
      correlationId,
      facts: { channel: this.name, direction: "inbound", stage: "extension" },
    });
    try {
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
          qq: route.metadata,
          ...(correlationId ? { [DIAGNOSTIC_CORRELATION_METADATA_KEY]: correlationId } : {}),
        }
      });
      this.commitIncoming(identity.messageId);
      await this.diagnostics.emit({
        domain: "channel.delivery",
        event: "inbound.submit.succeeded",
        component: "extension.qq",
        outcome: "succeeded",
        correlationId,
        facts: { channel: this.name, direction: "inbound", stage: "extension" },
      });
    } catch (error) {
      this.releaseIncoming(identity.messageId);
      const classification = classifyDiagnosticError(error);
      await this.diagnostics.emit({
        domain: "channel.delivery",
        event: classification.outcome === "cancelled" ? "inbound.submit.cancelled" : "inbound.submit.failed",
        component: "extension.qq",
        outcome: classification.outcome,
        correlationId,
        reasonCode: classification.reasonCode,
        providerCode: classification.providerCode,
        facts: {
          channel: this.name,
          direction: "inbound",
          stage: "extension",
          ...(classification.facts ?? {}),
        },
      });
      throw error;
    }
  };

  private createInboundCorrelationId = (event: QQMessageEvent): string | undefined => {
    const providerMessageId = event.message_id || event.id || "";
    return this.diagnostics.createInboundTraceId(providerMessageId);
  };

  private resolveIncomingIdentity = (event: QQMessageEvent): QQIncomingIdentity | null => {
    const messageId = event.message_id || event.id || "";
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

  private beginIncoming = (messageId: string): boolean => {
    if (!messageId) {
      return true;
    }
    if (this.processedSet.has(messageId) || this.processingSet.has(messageId)) {
      return false;
    }
    this.processingSet.add(messageId);
    return true;
  };

  private commitIncoming = (messageId: string): void => {
    if (!messageId) {
      return;
    }
    this.processingSet.delete(messageId);
    this.processedSet.add(messageId);
    this.processedIds.push(messageId);
    if (this.processedIds.length > 1000) {
      const removed = this.processedIds.splice(0, 500);
      for (const id of removed) {
        this.processedSet.delete(id);
      }
    }
  };

  private releaseIncoming = (messageId: string): void => {
    if (messageId) {
      this.processingSet.delete(messageId);
    }
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
    let candidate: QQBot | null = null;
    const startedAt = Date.now();
    this.diagnostics.emitGatewayConnectStarted(trigger, this.reconnectAttempt + 1);
    try {
      await this.verifyGatewaySessionAvailability();
      candidate = this.createBot();
      await this.startBotWithTimeout(candidate);
      if (!this.running) {
        await this.safeStopBot(candidate);
        return;
      }
      this.bot = candidate;
      this.reconnectAttempt = 0;
      this.diagnostics.emitGatewayConnectSucceeded(trigger, Date.now() - startedAt);
    } catch (error) {
      if (candidate) {
        await this.safeStopBot(candidate);
      }
      if (!this.running) {
        return;
      }
      this.reconnectAttempt += 1;
      const delayMs = this.getReconnectDelayMs(error, this.reconnectAttempt);
      this.diagnostics.emitGatewayConnectFailed({
        attempt: this.reconnectAttempt,
        durationMs: Date.now() - startedAt,
        error,
        reconnectInMs: delayMs,
        sessionLimit: error instanceof QQGatewaySessionLimitError,
        trigger,
      });
      this.scheduleReconnect(delayMs, `${trigger}-retry`);
    }
  };

  protected createBot = (): QQBot => {
    const generation = ++this.connectionGeneration;
    const bot = new Bot({
      appid: this.config.appId!,
      secret: this.config.secret!,
      mode: ReceiverMode.WEBSOCKET,
      intents: ["GROUP_AND_C2C_EVENT"],
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
      void this.handleSessionDead(bot, generation);
    });

    bot.sessionManager.on(SessionEvents.EVENT_WS, (data: unknown) => {
      const event = data && typeof data === "object" ? data as Record<string, unknown> : {};
      const eventType = typeof event.eventType === "string" ? event.eventType : "unknown";
      if (
        eventType !== SessionEvents.READY &&
        eventType !== SessionEvents.RESUMED &&
        eventType !== SessionEvents.DISCONNECT
      ) {
        return;
      }
      void this.diagnostics.emit({
        domain: "extension.lifecycle",
        event: `gateway.session.${eventType.toLowerCase()}`,
        component: "extension.qq",
        outcome: eventType === SessionEvents.DISCONNECT ? "unavailable" : "observed",
        providerCode: this.diagnostics.normalizeProviderCode(event.code),
        facts: { channel: this.name, generation },
      });
    });

    return bot;
  };

  protected verifyGatewaySessionAvailability = async (): Promise<void> => {
    await new QQGatewayStartupProbeService({
      appId: this.config.appId!,
      secret: this.config.secret!,
    }).verifySessionAvailable();
  };

  private handleSessionDead = async (bot: QQBot, generation: number): Promise<void> => {
    if (!this.running || this.bot !== bot) {
      return;
    }
    this.bot = null;
    await this.safeStopBot(bot);
    this.reconnectAttempt += 1;
    const delayMs = this.getBackoffDelayMs(this.reconnectAttempt);
    await this.diagnostics.emit({
      domain: "extension.lifecycle",
      event: "gateway.session.dead",
      component: "extension.qq",
      outcome: "unavailable",
      attempt: this.reconnectAttempt,
      facts: { channel: this.name, generation, reconnectInMs: delayMs },
    });
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

  private safeStopBot = async (bot: QQBot): Promise<void> => {
    bot.removeAllListeners("message.private");
    bot.removeAllListeners("message.group");
    bot.sessionManager.removeAllListeners(SessionEvents.DEAD);
    bot.sessionManager.removeAllListeners(SessionEvents.EVENT_WS);
    try {
      await bot.stop();
    } catch {
      // ignore cleanup errors
    }
  };

  private startBotWithTimeout = async (bot: QQBot): Promise<void> => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startupFailure = this.watchStartupFailure(bot);
    try {
      await Promise.race([
        bot.start(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`QQ bot start timed out after ${this.connectTimeoutMs}ms`)), this.connectTimeoutMs);
        }),
        new Promise<never>((_, reject) => {
          startupFailure.reject = reject;
        })
      ]);
    } finally {
      startupFailure.stop();
      if (timer) {
        clearTimeout(timer);
      }
    }
  };

  private watchStartupFailure = (bot: QQBot): {
    reject: ((error: Error) => void) | null;
    stop: () => void;
  } => {
    const state: {
      rejected: boolean;
      reject: ((error: Error) => void) | null;
      stop: () => void;
    } = {
      rejected: false,
      reject: null,
      stop: () => {},
    };
    const fail = (error: Error): void => {
      if (state.rejected) {
        return;
      }
      state.rejected = true;
      state.reject?.(error);
    };
    const onReceiverError = (error: unknown): void => {
      fail(new Error(`QQ bot websocket failed before ready: ${this.formatErrorMessage(error)}`));
    };
    const onReceiverClose = (code: number, reason: unknown): void => {
      fail(new Error(`QQ bot websocket closed before ready: code=${code}, reason=${this.formatCloseReason(reason)}`));
    };
    const onSessionError = (code: unknown, message: unknown): void => {
      fail(new Error(`QQ bot session failed before ready: code=${String(code)}, message=${this.formatErrorMessage(message)}`));
    };
    const onSessionEvent = (data: unknown): void => {
      const event = data && typeof data === "object" ? data as Record<string, unknown> : {};
      if (event.eventType !== SessionEvents.DISCONNECT) {
        return;
      }
      fail(
        new Error(
          `QQ bot session disconnected before ready: code=${String(event.code ?? "unknown")}, event=${this.formatErrorMessage(event.eventMsg)}`
        )
      );
    };
    bot.receiver.on("error", onReceiverError);
    bot.receiver.on("close", onReceiverClose);
    bot.sessionManager.on(SessionEvents.ERROR, onSessionError);
    bot.sessionManager.on(SessionEvents.EVENT_WS, onSessionEvent);
    state.stop = () => {
      bot.receiver.off("error", onReceiverError);
      bot.receiver.off("close", onReceiverClose);
      bot.sessionManager.off(SessionEvents.ERROR, onSessionError);
      bot.sessionManager.off(SessionEvents.EVENT_WS, onSessionEvent);
    };
    return state;
  };

  private formatCloseReason = (reason: unknown): string => {
    return Buffer.isBuffer(reason) ? reason.toString() : this.formatErrorMessage(reason);
  };

  private formatErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
      return error.message;
    }
    if (error && typeof error === "object") {
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    }
    return String(error);
  };

  get isRunning(): boolean {
    return this.bot !== null;
  }

  private getBackoffDelayMs = (attempt: number): number => {
    const jitter = Math.floor(Math.random() * 500);
    const exp = Math.min(this.reconnectMaxMs, this.reconnectBaseMs * 2 ** Math.max(0, attempt - 1));
    return Math.min(this.reconnectMaxMs, exp + jitter);
  };

  private getReconnectDelayMs = (error: unknown, attempt: number): number => {
    if (error instanceof QQGatewaySessionLimitError && typeof error.resetAfterMs === "number") {
      return Math.max(this.reconnectBaseMs, error.resetAfterMs);
    }
    return this.getBackoffDelayMs(attempt);
  };
}
