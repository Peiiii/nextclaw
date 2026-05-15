import type * as Lark from "@larksuiteoapi/node-sdk";
import type { NcpEndpointEvent } from "@nextclaw/ncp";
import { NcpReplyConsumer, type ChatTarget } from "@nextclaw/ncp-toolkit";
import {
  FileFeishuAccountStore,
  type FeishuAccountStore,
} from "../stores/feishu-account.store.js";
import {
  FeishuReplyChat,
  NcpEventQueue,
  TERMINAL_NCP_EVENT_TYPES,
  type FeishuReplySession,
} from "./feishu-reply-chat.service.js";
import { FeishuSdkService } from "./feishu-sdk.service.js";
import {
  isFeishuBotMentioned,
  isFeishuGroupChat,
  parseFeishuInboundMessage,
} from "../utils/feishu-message.utils.js";
import {
  readFeishuEventSessionId,
  resolveFeishuSessionRoute,
} from "../utils/feishu-session-route.utils.js";
import type {
  FeishuChannelAdapterContract,
  FeishuChannelConfig,
  FeishuInboundMessage,
  FeishuRuntimeAccount,
} from "../types/feishu-extension.types.js";

type FeishuCanonicalRoute = {
  conversationId: string;
  accountId?: string;
};

type FeishuAdapterDeps = {
  sdk?: FeishuSdkService;
  store?: FeishuAccountStore;
  logger?: Pick<typeof console, "warn" | "log">;
};

type FeishuWsHandle = {
  start: (params: { eventDispatcher: Lark.EventDispatcher }) => void;
  close?: () => void;
  stop?: () => void;
};

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

function normalizeRouteKey(conversationId: string): string {
  return conversationId.toLowerCase();
}

function isAllowedSender(allowFrom: string[], senderId: string): boolean {
  return allowFrom.length === 0 || allowFrom.includes(senderId);
}

export class FeishuChannelAdapter implements FeishuChannelAdapterContract {
  private messageHandler: ((message: FeishuInboundMessage) => void | Promise<void>) | null = null;
  private readonly sdk: FeishuSdkService;
  private readonly store: FeishuAccountStore;
  private readonly logger: Pick<typeof console, "warn" | "log">;
  private readonly replyConsumer: NcpReplyConsumer;
  private readonly wsClients = new Map<string, FeishuWsHandle>();
  private readonly replySessions = new Map<string, FeishuReplySession>();
  private readonly canonicalRoutes = new Map<string, FeishuCanonicalRoute>();
  private running = false;
  private config: FeishuChannelConfig = {};

  constructor(deps: FeishuAdapterDeps = {}) {
    this.sdk = deps.sdk ?? new FeishuSdkService();
    this.store = deps.store ?? new FileFeishuAccountStore();
    this.logger = deps.logger ?? console;
    this.replyConsumer = new NcpReplyConsumer(
      new FeishuReplyChat({
        resolveAccount: this.resolveSendAccount,
        sendText: this.sendText,
      }),
    );
  }

  readonly configure = async (config: FeishuChannelConfig): Promise<void> => {
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
      const account = this.resolveRuntimeAccount(accountId);
      if (account?.enabled) {
        this.startAccount(account);
      }
    }
  };

  readonly stop = async (): Promise<void> => {
    if (!this.running) {
      return;
    }
    this.running = false;
    for (const client of this.wsClients.values()) {
      client.close?.();
      client.stop?.();
    }
    this.wsClients.clear();
    for (const session of this.replySessions.values()) {
      session.queue.close();
    }
    this.replySessions.clear();
  };

  readonly onMessage = (
    handler: (message: FeishuInboundMessage) => void | Promise<void>,
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
    const route = resolveFeishuSessionRoute(event);
    if (!route) {
      return;
    }
    const sessionId = readFeishuEventSessionId(event);
    if (!sessionId) {
      return;
    }
    const session = this.resolveReplySession(sessionId, this.resolveCanonicalRoute(route));
    session.queue.push(event);
    if (TERMINAL_NCP_EVENT_TYPES.has(event.type)) {
      session.queue.close();
      this.replySessions.delete(sessionId);
      await session.consuming;
    }
  };

  readonly emitMessageForTest = async (message: FeishuInboundMessage): Promise<void> => {
    await this.messageHandler?.(message);
  };

  private readonly startAccount = (account: FeishuRuntimeAccount): void => {
    const dispatcher = this.sdk.createEventDispatcher();
    dispatcher.register({
      "im.message.receive_v1": async (data: unknown) => {
        await this.handleInboundEvent(account, data);
      },
    });
    const wsClient = this.sdk.createWsClient(account) as unknown as FeishuWsHandle;
    wsClient.start({ eventDispatcher: dispatcher });
    this.wsClients.set(account.accountId, wsClient);
    this.logger.log?.(`[feishu] websocket started for ${account.accountId}`);
  };

  private readonly listAvailableAccountIds = (): string[] => {
    return Array.from(new Set([
      ...(this.config.defaultAccountId ? [this.config.defaultAccountId] : []),
      ...Object.keys(this.config.accounts ?? {}),
      ...this.store.listAccountIds(),
    ]));
  };

  private readonly resolveRuntimeAccount = (accountId: string): FeishuRuntimeAccount | null => {
    const stored = this.store.loadAccount(accountId);
    if (!stored?.appId || !stored.appSecret) {
      return null;
    }
    const accountConfig = this.config.accounts?.[accountId] ?? {};
    return {
      accountId,
      appId: stored.appId,
      appSecret: stored.appSecret,
      domain: accountConfig.domain ?? stored.domain ?? this.config.domain ?? "feishu",
      enabled: accountConfig.enabled !== false && this.config.enabled !== false,
      name: accountConfig.name ?? stored.botName,
      botOpenId: stored.botOpenId,
      allowFrom: Array.from(new Set([
        ...readStringArray(this.config.allowFrom),
        ...readStringArray(accountConfig.allowFrom),
      ])),
      groupPolicy: accountConfig.groupPolicy ?? this.config.groupPolicy ?? "open",
      requireMention: accountConfig.requireMention ?? this.config.requireMention ?? true,
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
    throw new Error("feishu send failed: accountId is required when multiple accounts are configured");
  };

  private readonly resolveSendAccount = (target: ChatTarget): FeishuRuntimeAccount => {
    const account = this.resolveRuntimeAccount(this.resolveSelectedAccountId(target.accountId));
    if (!account?.enabled) {
      throw new Error(`feishu send failed: account "${target.accountId ?? this.config.defaultAccountId ?? ""}" is not connected`);
    }
    return account;
  };

  private readonly resolveReplySession = (
    sessionId: string,
    route: FeishuCanonicalRoute,
  ): FeishuReplySession => {
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

  private readonly resolveCanonicalRoute = (
    route: FeishuCanonicalRoute,
  ): FeishuCanonicalRoute => {
    const remembered = this.canonicalRoutes.get(normalizeRouteKey(route.conversationId));
    if (remembered) {
      return {
        ...remembered,
        ...(route.accountId ? { accountId: route.accountId } : {}),
      };
    }
    return route;
  };

  private readonly handleInboundEvent = async (
    account: FeishuRuntimeAccount,
    rawEvent: unknown,
  ): Promise<void> => {
    const parsed = parseFeishuInboundMessage(rawEvent);
    if (!parsed || !isAllowedSender(account.allowFrom, parsed.senderOpenId)) {
      return;
    }
    if (isFeishuGroupChat(parsed.chatType)) {
      if (account.groupPolicy === "disabled") {
        return;
      }
      if (account.groupPolicy === "allowlist" && !account.allowFrom.includes(parsed.chatId)) {
        return;
      }
      if (account.requireMention && !isFeishuBotMentioned({
        botOpenId: account.botOpenId,
        mentionedOpenIds: parsed.mentionedOpenIds,
      })) {
        return;
      }
    }
    this.canonicalRoutes.set(normalizeRouteKey(parsed.chatId), {
      accountId: account.accountId,
      conversationId: parsed.chatId,
    });
    await this.messageHandler?.({
      conversationId: parsed.chatId,
      senderId: parsed.senderOpenId,
      text: parsed.text,
      accountId: account.accountId,
      peerKind: isFeishuGroupChat(parsed.chatType) ? "group" : "direct",
      messageId: parsed.messageId,
      raw: rawEvent,
    });
  };

  private readonly sendText = async (params: {
    account: FeishuRuntimeAccount;
    conversationId: string;
    text: string;
  }): Promise<void> => {
    await this.sdk.sendText({
      account: params.account,
      chatId: params.conversationId,
      text: params.text,
    });
  };
}
