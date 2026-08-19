import {
  DIAGNOSTIC_CORRELATION_METADATA_KEY,
  classifyDiagnosticError,
  type BusChannelRuntime,
} from "@nextclaw/extension-sdk";
import type { Bot, ReceiverMode } from "qq-official-bot";
import type { QQDiagnosticsService } from "./qq-diagnostics.service.js";

type QQBot = Bot<ReceiverMode.WEBSOCKET>;
type QQMessageType = "private" | "group";
type SendMessage = Parameters<BusChannelRuntime["send"]>[0];

export class QQOutboundDeliveryService {
  constructor(
    private readonly getBot: () => QQBot | null,
    private readonly diagnostics: QQDiagnosticsService,
  ) {}

  send = async (msg: SendMessage): Promise<void> => {
    const qqMeta = (msg.metadata?.qq as Record<string, unknown> | undefined) ?? {};
    const messageType = (qqMeta.messageType as QQMessageType | undefined) ?? "private";
    const replyTo = msg.replyTo ?? (msg.metadata?.message_id as string | undefined);
    const source = replyTo ? { id: replyTo } : undefined;
    const correlationId = typeof msg.metadata?.[DIAGNOSTIC_CORRELATION_METADATA_KEY] === "string"
      ? msg.metadata[DIAGNOSTIC_CORRELATION_METADATA_KEY]
      : undefined;
    const startedAt = Date.now();

    this.emitDeliveryStarted(correlationId, messageType);
    const bot = this.getBot();
    if (!bot) {
      this.emitDisconnected(correlationId, messageType, startedAt);
      throw new Error("QQ channel is not connected");
    }
    this.emitTransportStarted(correlationId);

    try {
      await this.sendWithUrlFallback({
        bot,
        messageType,
        msg,
        payload: msg.content,
        qqMeta,
        source,
      });
      this.emitSucceeded(correlationId, messageType, startedAt);
    } catch (error) {
      this.emitFailed(error, correlationId, messageType, startedAt);
      throw error;
    }
  };

  private sendWithUrlFallback = async (params: {
    bot: QQBot;
    messageType: QQMessageType;
    msg: SendMessage;
    payload: string;
    qqMeta: Record<string, unknown>;
    source: { id: string } | undefined;
  }): Promise<void> => {
    try {
      await this.sendByMessageType(params);
    } catch (error) {
      if (!this.isDisallowedUrlParamError(error)) throw error;
      await this.sendByMessageType({
        ...params,
        payload: this.toQqSafeText(params.payload, error),
      });
    }
  };

  private sendByMessageType = async (params: {
    bot: QQBot;
    messageType: QQMessageType;
    msg: SendMessage;
    payload: unknown;
    qqMeta: Record<string, unknown>;
    source: { id: string } | undefined;
  }): Promise<void> => {
    const { bot, messageType, msg, payload, qqMeta, source } = params;
    if (messageType === "group") {
      const groupId = (qqMeta.groupId as string | undefined) ?? msg.chatId;
      await this.sendWithTokenRetry(bot, () => bot.sendGroupMessage(groupId, payload, source));
      return;
    }
    const userId = (qqMeta.userId as string | undefined) ?? msg.chatId;
    await this.sendWithTokenRetry(bot, () => bot.sendPrivateMessage(userId, payload, source));
  };

  private sendWithTokenRetry = async (bot: QQBot, send: () => Promise<unknown>): Promise<void> => {
    try {
      await send();
    } catch (error) {
      if (!this.isTokenExpiredError(error)) throw error;
      await bot.sessionManager.getAccessToken();
      await send();
    }
  };

  private emitDeliveryStarted = (
    correlationId: string | undefined,
    messageType: QQMessageType,
  ): void => {
    this.diagnostics.emit({
      domain: "channel.delivery",
      event: "provider.send.started",
      component: "extension.qq",
      outcome: "started",
      correlationId,
      facts: { channel: "qq", direction: "outbound", stage: "provider", messageType },
    });
  };

  private emitTransportStarted = (correlationId: string | undefined): void => {
    this.diagnostics.emit({
      domain: "transport.request",
      event: "qq.message-send.started",
      component: "extension.qq",
      outcome: "started",
      correlationId,
      facts: { transportKind: "http", operation: "message-send" },
    });
  };

  private emitDisconnected = (
    correlationId: string | undefined,
    messageType: QQMessageType,
    startedAt: number,
  ): void => {
    this.diagnostics.emit({
      domain: "channel.delivery",
      event: "provider.send.failed",
      component: "extension.qq",
      outcome: "failed",
      correlationId,
      reasonCode: "channel_not_connected",
      durationMs: Date.now() - startedAt,
      facts: { channel: "qq", direction: "outbound", stage: "provider", messageType },
    });
  };

  private emitSucceeded = (
    correlationId: string | undefined,
    messageType: QQMessageType,
    startedAt: number,
  ): void => {
    const durationMs = Date.now() - startedAt;
    this.diagnostics.emit({
      domain: "channel.delivery",
      event: "provider.send.succeeded",
      component: "extension.qq",
      outcome: "succeeded",
      correlationId,
      durationMs,
      facts: { channel: "qq", direction: "outbound", stage: "provider", messageType },
    });
    this.diagnostics.emit({
      domain: "transport.request",
      event: "qq.message-send.succeeded",
      component: "extension.qq",
      outcome: "succeeded",
      correlationId,
      durationMs,
      facts: { transportKind: "http", operation: "message-send" },
    });
  };

  private emitFailed = (
    error: unknown,
    correlationId: string | undefined,
    messageType: QQMessageType,
    startedAt: number,
  ): void => {
    const classification = classifyDiagnosticError(error);
    const providerCode = this.diagnostics.readProviderCode(error) ?? classification.providerCode;
    const durationMs = Date.now() - startedAt;
    this.diagnostics.emit({
      domain: "channel.delivery",
      event: classification.outcome === "cancelled" ? "provider.send.cancelled" : "provider.send.failed",
      component: "extension.qq",
      outcome: classification.outcome,
      correlationId,
      durationMs,
      reasonCode: classification.reasonCode,
      providerCode,
      facts: {
        channel: "qq",
        direction: "outbound",
        stage: "provider",
        messageType,
        ...(classification.facts ?? {}),
      },
    });
    this.diagnostics.emit({
      domain: "transport.request",
      event: classification.outcome === "cancelled" ? "qq.message-send.cancelled" : "qq.message-send.failed",
      component: "extension.qq",
      outcome: classification.outcome,
      correlationId,
      durationMs,
      reasonCode: classification.reasonCode,
      providerCode,
      facts: {
        transportKind: "http",
        operation: "message-send",
        ...(classification.facts ?? {}),
      },
    });
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
    const safe = content
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
      .replace(/https?:\/\/\S+/gi, "[link]")
      .replace(/www\.\S+/gi, "[link]")
      .replace(/\b[a-z0-9._/-]+\.md\b/gi, "[file]");
    const blocked = this.extractBlockedUrlToken(error);
    return blocked ? safe.replaceAll(blocked, "[link]") : safe;
  };

  private extractBlockedUrlToken = (error: unknown): string | null => {
    const message = error instanceof Error ? error.message : String(error);
    const token = message.match(/包含url\s+([^\s]+)/)?.[1]?.trim();
    return token || null;
  };
}
