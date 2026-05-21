import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import type { NcpEndpointEvent } from "@nextclaw/ncp";
import { NcpReplyConsumer, type ChatTarget } from "@nextclaw/ncp-toolkit";
import { FileWeixinAccountStore, type WeixinAccountStore } from "../stores/weixin-account.store.js";
import { HttpWeixinApiClient, type WeixinApiClient, type WeixinMessage } from "./weixin-api.service.js";
import {
  NcpEventQueue,
  TERMINAL_NCP_EVENT_TYPES,
  WeixinReplyChat,
  type WeixinReplySession,
} from "./weixin-reply-chat.service.js";
import { resolveWeixinInboundAttachments } from "../utils/weixin-inbound-media.utils.js";
import { readWeixinEventSessionId, resolveWeixinSessionRoute } from "../utils/weixin-session-route.utils.js";
import { WeixinTypingController } from "./weixin-typing-controller.service.js";
import type {
  WeixinChannelConfig,
  WeixinInboundMessage,
  WeixinRuntimeAccount,
} from "../types/weixin-extension.types.js";

type WeixinCanonicalRoute = {
  conversationId: string;
  accountId?: string;
};

type WeixinAdapterDeps = {
  api?: WeixinApiClient;
  store?: WeixinAccountStore;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  logger?: Pick<typeof console, "warn">;
};

const DEFAULT_WEIXIN_BASE_URL = "https://ilinkai.weixin.qq.com";
const DEFAULT_WEIXIN_POLL_TIMEOUT_MS = 35_000;
const WEIXIN_MESSAGE_ITEM_TYPE_IMAGE = 2;
const WEIXIN_MESSAGE_ITEM_TYPE_VOICE = 3;
const WEIXIN_MESSAGE_ITEM_TYPE_FILE = 4;
const WEIXIN_MESSAGE_ITEM_TYPE_VIDEO = 5;

function textHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}

function writeWeixinDebugProbe(event: string, payload: Record<string, unknown>): void {
  const file = process.env.NEXTCLAW_WEIXIN_DEBUG_LOG?.trim();
  if (!file) {
    return;
  }
  appendFileSync(file, `${JSON.stringify({
    at: new Date().toISOString(),
    event,
    pid: process.pid,
    ...payload,
  })}\n`);
}

async function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, Math.max(0, ms));
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function isAllowedSender(allowFrom: string[], senderId: string): boolean {
  if (allowFrom.length === 0) {
    return true;
  }
  if (allowFrom.includes(senderId)) {
    return true;
  }
  return senderId.includes("|") && senderId.split("|").some((part) => allowFrom.includes(part));
}

function normalizeRouteKey(conversationId: string): string {
  return conversationId.toLowerCase();
}

function isSyntheticAttachmentText(text: string): boolean {
  return (
    text === "[收到图片]" ||
    text === "[收到视频]" ||
    text === "[收到语音]" ||
    /^\[收到文件(?:: .+)?]$/.test(text)
  );
}

function extractText(message: WeixinMessage): string {
  const items = Array.isArray(message.item_list) ? message.item_list : [];
  for (const item of items) {
    const text = item.text_item?.text?.trim();
    if (text) {
      return text;
    }
    const voiceText = item.voice_item?.text?.trim();
    if (voiceText) {
      return voiceText;
    }
  }
  for (const item of items) {
    if (item.type === WEIXIN_MESSAGE_ITEM_TYPE_IMAGE) {
      return "[收到图片]";
    }
    if (item.type === WEIXIN_MESSAGE_ITEM_TYPE_VIDEO) {
      return "[收到视频]";
    }
    if (item.type === WEIXIN_MESSAGE_ITEM_TYPE_VOICE) {
      return "[收到语音]";
    }
    if (item.type === WEIXIN_MESSAGE_ITEM_TYPE_FILE) {
      const fileName = item.file_item?.file_name?.trim();
      return fileName ? `[收到文件: ${fileName}]` : "[收到文件]";
    }
  }
  return "";
}

export class WeixinChannelAdapter {
  private messageHandler: ((message: WeixinInboundMessage) => void | Promise<void>) | null = null;
  private readonly api: WeixinApiClient;
  private readonly store: WeixinAccountStore;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly logger: Pick<typeof console, "warn">;
  private readonly replyConsumer: NcpReplyConsumer;
  private readonly typingController: WeixinTypingController;
  private readonly contextTokens = new Map<string, string>();
  private readonly accountControllers = new Map<string, AbortController>();
  private readonly pollTasks: Promise<void>[] = [];
  private readonly replySessions = new Map<string, WeixinReplySession>();
  private readonly canonicalRoutes = new Map<string, WeixinCanonicalRoute>();
  private running = false;
  private config: WeixinChannelConfig = {};

  constructor(deps: WeixinAdapterDeps = {}) {
    this.api = deps.api ?? new HttpWeixinApiClient();
    this.store = deps.store ?? new FileWeixinAccountStore();
    this.sleep = deps.sleep ?? defaultSleep;
    this.logger = deps.logger ?? console;
    this.typingController = new WeixinTypingController({
      fetchTicket: async (runtime) => {
        const response = await this.api.fetchConfig({
          baseUrl: runtime.baseUrl,
          token: runtime.token,
          ilinkUserId: runtime.userId,
          contextToken: runtime.contextToken,
        });
        return response.typing_ticket?.trim();
      },
      sendTyping: async (params) => {
        const { baseUrl, status, ticket, token, userId } = params;
        await this.api.sendTyping({
          baseUrl,
          token,
          toUserId: userId,
          typingTicket: ticket,
          status,
        });
      },
    });
    this.replyConsumer = new NcpReplyConsumer(
      new WeixinReplyChat({
        resolveAccount: this.resolveSendAccount,
        resolveContextToken: this.resolveContextToken,
        sendText: this.sendText,
        typingController: this.typingController,
      }),
    );
  }

  readonly configure = async (config: WeixinChannelConfig): Promise<void> => {
    this.config = config;
    if (!this.running) {
      return;
    }
    await this.stop();
    await this.start();
  };

  readonly start = async (): Promise<void> => {
    if (this.running) {
      return;
    }
    this.running = true;
    for (const accountId of this.listAvailableAccountIds()) {
      const controller = new AbortController();
      this.accountControllers.set(accountId, controller);
      this.pollTasks.push(this.runPollingLoop(accountId, controller.signal));
    }
  };

  readonly stop = async (): Promise<void> => {
    if (!this.running) {
      return;
    }
    this.running = false;
    for (const controller of this.accountControllers.values()) {
      controller.abort();
    }
    this.accountControllers.clear();
    for (const session of this.replySessions.values()) {
      session.queue.close();
    }
    this.replySessions.clear();
    await Promise.allSettled(this.pollTasks.splice(0, this.pollTasks.length));
    await this.typingController.stopAll();
  };

  readonly onMessage = (
    handler: (message: WeixinInboundMessage) => void | Promise<void>,
  ): (() => void) => {
    this.messageHandler = handler;
    return () => {
      if (this.messageHandler === handler) {
        this.messageHandler = null;
      }
    };
  };

  readonly sendNcpEvent = async (event: NcpEndpointEvent): Promise<void> => {
    if (!this.running) {
      return;
    }
    const route = resolveWeixinSessionRoute(event);
    if (!route) {
      return;
    }
    const sessionId = readWeixinEventSessionId(event);
    if (!sessionId) {
      return;
    }
    writeWeixinDebugProbe("ncp-event", {
      sessionId,
      type: event.type,
      replySessionOpen: this.replySessions.has(sessionId),
      routeConversationId: route.conversationId,
      routeAccountId: route.accountId,
      messageId: "payload" in event && event.payload && typeof event.payload === "object" &&
        "messageId" in event.payload ? event.payload.messageId : undefined,
      runId: "payload" in event && event.payload && typeof event.payload === "object" &&
        "runId" in event.payload ? event.payload.runId : undefined,
    });
    const session = this.resolveReplySession(sessionId, this.resolveCanonicalRoute(route));
    session.queue.push(event);
    if (TERMINAL_NCP_EVENT_TYPES.has(event.type)) {
      session.queue.close();
      this.replySessions.delete(sessionId);
      await session.consuming;
    }
  };

  readonly emitMessageForTest = async (message: WeixinInboundMessage): Promise<void> => {
    await this.messageHandler?.(message);
  };

  readonly sendText = async (params: {
    account: WeixinRuntimeAccount;
    conversationId: string;
    text: string;
    contextToken?: string;
  }): Promise<void> => {
    const { account, contextToken, conversationId, text } = params;
    writeWeixinDebugProbe("send-text", {
      accountId: account.accountId,
      conversationId,
      textHash: textHash(text),
      textLength: text.length,
      textPreview: text.slice(0, 80),
      hasContextToken: Boolean(contextToken),
    });
    await this.api.sendTextMessage({
      baseUrl: account.baseUrl,
      token: account.token,
      toUserId: conversationId,
      text,
      contextToken,
    });
  };

  readonly sendOutboundText = async (params: {
    to: string;
    text: string;
    accountId?: string | null;
  }): Promise<void> => {
    const { accountId, text, to } = params;
    const target: ChatTarget = {
      conversationId: to,
      ...(accountId ? { accountId } : {}),
    };
    const account = this.resolveSendAccount(target);
    await this.sendText({
      account,
      conversationId: target.conversationId,
      text,
      contextToken: this.resolveContextToken(target, account.accountId),
    });
  };

  private readonly resolveReplySession = (
    sessionId: string,
    route: WeixinCanonicalRoute,
  ): WeixinReplySession => {
    const existing = this.replySessions.get(sessionId);
    if (existing) {
      return existing;
    }
    const queue = new NcpEventQueue();
    const consuming = this.replyConsumer.consume({
      target: {
        conversationId: route.conversationId,
        ...(route.accountId ? { accountId: route.accountId } : {}),
      },
      eventStream: queue,
    });
    const session = { queue, consuming };
    this.replySessions.set(sessionId, session);
    return session;
  };

  private readonly listAvailableAccountIds = (): string[] => {
    const configuredAccountIds = this.listConfiguredAccountIds();
    if (configuredAccountIds.length > 0) {
      return configuredAccountIds;
    }
    return this.store.listAccountIds();
  };

  private readonly listConfiguredAccountIds = (): string[] => {
    return Array.from(new Set([
      ...(this.config.defaultAccountId ? [this.config.defaultAccountId] : []),
      ...Object.keys(this.config.accounts ?? {}),
    ]));
  };

  private readonly resolveCanonicalRoute = (
    route: WeixinCanonicalRoute,
  ): WeixinCanonicalRoute => {
    const remembered = this.canonicalRoutes.get(normalizeRouteKey(route.conversationId));
    if (remembered) {
      return {
        ...remembered,
        ...(route.accountId ? { accountId: route.accountId } : {}),
      };
    }
    return this.resolveConfiguredCanonicalRoute(route.conversationId) ?? route;
  };

  private readonly resolveConfiguredCanonicalRoute = (
    conversationId: string,
  ): WeixinCanonicalRoute | null => {
    const routeKey = normalizeRouteKey(conversationId);
    const globalMatch = readStringArray(this.config.allowFrom)
      .find((candidate) => normalizeRouteKey(candidate) === routeKey);
    if (globalMatch) {
      return { conversationId: globalMatch };
    }
    for (const [accountId, accountConfig] of Object.entries(this.config.accounts ?? {})) {
      const accountMatch = readStringArray(accountConfig.allowFrom)
        .find((candidate) => normalizeRouteKey(candidate) === routeKey);
      if (accountMatch) {
        return { accountId, conversationId: accountMatch };
      }
    }
    return null;
  };

  private readonly resolveRuntimeAccount = (accountId: string): WeixinRuntimeAccount | null => {
    const configuredAccountIds = this.listConfiguredAccountIds();
    if (configuredAccountIds.length > 0 && !configuredAccountIds.includes(accountId)) {
      return null;
    }
    const stored = this.store.loadAccount(accountId);
    if (!stored?.token) {
      return null;
    }
    const accountConfig = this.config.accounts?.[accountId] ?? {};
    return {
      accountId,
      token: stored.token,
      enabled: accountConfig.enabled !== false && this.config.enabled !== false,
      baseUrl: accountConfig.baseUrl || stored.baseUrl || this.config.baseUrl || DEFAULT_WEIXIN_BASE_URL,
      pollTimeoutMs: this.config.pollTimeoutMs ?? DEFAULT_WEIXIN_POLL_TIMEOUT_MS,
      allowFrom: Array.from(new Set([
        ...readStringArray(this.config.allowFrom),
        ...readStringArray(accountConfig.allowFrom),
      ])),
    };
  };

  private readonly resolveSelectedAccountId = (requestedAccountId?: string): string => {
    if (requestedAccountId) {
      return requestedAccountId;
    }
    if (this.config.defaultAccountId) {
      return this.config.defaultAccountId;
    }
    const accountIds = this.listAvailableAccountIds();
    if (accountIds.length === 1 && accountIds[0]) {
      return accountIds[0];
    }
    throw new Error("weixin send failed: accountId is required when multiple accounts are configured");
  };

  private readonly resolveSendAccount = (target: ChatTarget): WeixinRuntimeAccount => {
    const account = this.resolveRuntimeAccount(this.resolveSelectedAccountId(target.accountId));
    if (!account?.enabled || !account.token) {
      throw new Error(`weixin send failed: account "${target.accountId ?? this.config.defaultAccountId ?? ""}" is not logged in`);
    }
    return account;
  };

  private readonly resolveContextToken = (target: ChatTarget, accountId: string): string | undefined => {
    const metadataToken = target.metadata?.context_token;
    if (typeof metadataToken === "string" && metadataToken.trim()) {
      return metadataToken.trim();
    }
    return this.contextTokens.get(`${accountId}:${target.conversationId}`);
  };

  private readonly runPollingLoop = async (accountId: string, signal: AbortSignal): Promise<void> => {
    while (this.running && !signal.aborted) {
      try {
        const account = this.resolveRuntimeAccount(accountId);
        if (!account?.enabled) {
          await this.sleep(3_000, signal);
          continue;
        }
        const response = await this.api.fetchUpdates({
          baseUrl: account.baseUrl,
          token: account.token,
          cursor: this.store.loadCursor(accountId),
          timeoutMs: account.pollTimeoutMs,
          signal,
        });
        if (response.get_updates_buf !== undefined) {
          this.store.saveCursor(accountId, response.get_updates_buf);
        }
        for (const message of response.msgs ?? []) {
          await this.handleInboundMessage(account, message);
        }
      } catch (error) {
        if (!signal.aborted) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.includes("errcode=-14") || message.includes("session timeout")) {
            this.store.deleteCursor(accountId);
            await this.sleep(1_000, signal);
            continue;
          }
          this.logger.warn(`[weixin] polling failed for ${accountId}: ${message}`);
          await this.sleep(3_000, signal);
        }
      }
    }
  };

  private readonly handleInboundMessage = async (
    account: WeixinRuntimeAccount,
    message: WeixinMessage,
  ): Promise<void> => {
    const senderId = message.from_user_id?.trim();
    if (!senderId || senderId === account.accountId || !isAllowedSender(account.allowFrom, senderId)) {
      return;
    }
    const attachments = await resolveWeixinInboundAttachments({
      message,
      baseUrl: account.baseUrl,
    });
    const extractedText = extractText(message);
    const text =
      attachments.length > 0 && isSyntheticAttachmentText(extractedText)
        ? ""
        : extractedText;
    if (!text && attachments.length === 0) {
      return;
    }
    writeWeixinDebugProbe("inbound-message", {
      accountId: account.accountId,
      senderId,
      messageId: message.message_id,
      textHash: text ? textHash(text) : undefined,
      textLength: text.length,
      textPreview: text.slice(0, 80),
      attachmentCount: attachments.length,
    });
    const contextToken = message.context_token?.trim();
    if (contextToken) {
      this.contextTokens.set(`${account.accountId}:${senderId}`, contextToken);
    }
    this.canonicalRoutes.set(normalizeRouteKey(senderId), {
      accountId: account.accountId,
      conversationId: senderId,
    });
    if (contextToken) {
      void this.typingController.start({
        accountId: account.accountId,
        userId: senderId,
        contextToken,
        baseUrl: account.baseUrl,
        token: account.token,
      });
    }
    await this.messageHandler?.({
      conversationId: senderId,
      senderId,
      text,
      attachments,
      accountId: account.accountId,
      ...(contextToken ? { contextToken } : {}),
      raw: message,
    });
  };
}
