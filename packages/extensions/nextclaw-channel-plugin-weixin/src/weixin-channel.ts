import type { MessageBus } from "@nextclaw/core";
import { BaseChannel, isTypingStopControlMessage, type OutboundMessage } from "@nextclaw/core";
import { loadWeixinAccount, loadWeixinCursor, saveWeixinCursor, listStoredWeixinAccountIds } from "./weixin-account.store.js";
import {
  extractWeixinMessageText,
  fetchWeixinConfig,
  fetchWeixinUpdates,
  sendWeixinTyping,
  sendWeixinTextMessage,
  type WeixinMessage,
} from "./weixin-api.client.js";
import { getWeixinContextToken, setWeixinContextToken } from "./weixin-context-token.store.js";
import { WeixinTypingController } from "./weixin-typing-controller.js";
import {
  DEFAULT_WEIXIN_BASE_URL,
  DEFAULT_WEIXIN_POLL_TIMEOUT_MS,
  resolveConfiguredWeixinAccountIds,
  resolveWeixinAccountSelection,
  type WeixinAccountConfig,
  type WeixinPluginConfig,
} from "./weixin-config.js";

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

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, Math.max(0, ms));
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

type ResolvedWeixinAccountRuntime = {
  accountId: string;
  token: string;
  enabled: boolean;
  baseUrl: string;
  pollTimeoutMs: number;
  allowFrom: string[];
};

export class WeixinChannel extends BaseChannel<Record<string, unknown>> {
  private readonly pollTasks: Promise<void>[] = [];
  private readonly accountControllers = new Map<string, AbortController>();
  private readonly typingController: WeixinTypingController;

  constructor(
    private readonly pluginConfig: WeixinPluginConfig,
    bus: MessageBus,
  ) {
    super(pluginConfig as Record<string, unknown>, bus);
    this.typingController = new WeixinTypingController({
      fetchTicket: async (runtime) => {
        const response = await fetchWeixinConfig({
          baseUrl: runtime.baseUrl,
          token: runtime.token,
          ilinkUserId: runtime.userId,
          contextToken: runtime.contextToken,
        });
        if (response.ret !== 0 || (response.errcode ?? 0) !== 0) {
          return undefined;
        }
        return response.typing_ticket?.trim();
      },
      sendTyping: async (params) => {
        await sendWeixinTyping({
          baseUrl: params.baseUrl,
          token: params.token,
          toUserId: params.userId,
          typingTicket: params.ticket,
          status: params.status,
        });
      },
    });
  }

  get name(): string {
    return "weixin";
  }

  start = async (): Promise<void> => {
    if (this.running) {
      return;
    }
    this.running = true;
    const accountIds = new Set<string>([
      ...resolveConfiguredWeixinAccountIds(this.pluginConfig),
      ...listStoredWeixinAccountIds(),
    ]);
    for (const accountId of accountIds) {
      const controller = new AbortController();
      this.accountControllers.set(accountId, controller);
      this.pollTasks.push(this.runAccountPollingLoop(accountId, controller.signal));
    }
  };

  stop = async (): Promise<void> => {
    this.running = false;
    for (const controller of this.accountControllers.values()) {
      controller.abort();
    }
    this.accountControllers.clear();
    await Promise.allSettled(this.pollTasks.splice(0, this.pollTasks.length));
    await this.typingController.stopAll();
  };

  send = async (msg: OutboundMessage): Promise<void> => {
    const accountId = resolveWeixinAccountSelection(
      this.pluginConfig,
      Array.from(new Set([...resolveConfiguredWeixinAccountIds(this.pluginConfig), ...listStoredWeixinAccountIds()])),
      typeof msg.metadata.accountId === "string" ? msg.metadata.accountId : null,
    );
    if (!accountId) {
      throw new Error("weixin send failed: accountId is required when multiple accounts are configured");
    }

    const account = this.resolveAccountRuntime(accountId);
    if (!account?.enabled || !account.token) {
      throw new Error(`weixin send failed: account "${accountId}" is not logged in`);
    }

    try {
      await sendWeixinTextMessage({
        baseUrl: account.baseUrl,
        token: account.token,
        toUserId: msg.chatId,
        text: msg.content,
        contextToken: getWeixinContextToken(account.accountId, msg.chatId),
      });
    } finally {
      await this.typingController.stop({
        accountId: account.accountId,
        userId: msg.chatId,
      });
    }
  };

  override async handleControlMessage(msg: OutboundMessage): Promise<boolean> {
    if (!isTypingStopControlMessage(msg)) {
      return false;
    }
    const accountId = this.resolveAccountIdFromMetadata(msg.metadata);
    if (!accountId) {
      return true;
    }
    await this.typingController.stop({
      accountId,
      userId: msg.chatId,
    });
    return true;
  }

  private resolveAccountRuntime = (accountId: string): ResolvedWeixinAccountRuntime | null => {
    const stored = loadWeixinAccount(accountId);
    if (!stored?.token) {
      return null;
    }
    const accountConfig: WeixinAccountConfig = this.pluginConfig.accounts?.[accountId] ?? {};
    return {
      accountId,
      token: stored.token,
      enabled: accountConfig.enabled !== false && this.pluginConfig.enabled !== false,
      baseUrl: accountConfig.baseUrl || stored.baseUrl || this.pluginConfig.baseUrl || DEFAULT_WEIXIN_BASE_URL,
      pollTimeoutMs: this.pluginConfig.pollTimeoutMs ?? DEFAULT_WEIXIN_POLL_TIMEOUT_MS,
      allowFrom: Array.from(
        new Set([...readStringArray(this.pluginConfig.allowFrom), ...readStringArray(accountConfig.allowFrom)]),
      ),
    };
  };

  private runAccountPollingLoop = async (accountId: string, signal: AbortSignal): Promise<void> => {
    while (this.running && !signal.aborted) {
      try {
        const account = this.resolveAccountRuntime(accountId);
        if (!account?.enabled) {
          await sleep(3_000, signal);
          continue;
        }

        const response = await fetchWeixinUpdates({
          baseUrl: account.baseUrl,
          token: account.token,
          cursor: loadWeixinCursor(accountId),
          timeoutMs: account.pollTimeoutMs,
          signal,
        });

        if (response.get_updates_buf !== undefined) {
          saveWeixinCursor(accountId, response.get_updates_buf);
        }

        for (const message of response.msgs ?? []) {
          await this.handleInboundWeixinMessage(account, message);
        }
      } catch (error) {
        if (!signal.aborted) {
          // eslint-disable-next-line no-console
          console.warn(`[weixin] polling failed for ${accountId}: ${String(error)}`);
          await sleep(3_000, signal);
        }
      }
    }
  };

  private handleInboundWeixinMessage = async (
    account: ResolvedWeixinAccountRuntime,
    message: WeixinMessage,
  ): Promise<void> => {
    const senderId = message.from_user_id?.trim();
    if (!senderId || senderId === account.accountId) {
      return;
    }
    if (!isAllowedSender(account.allowFrom, senderId)) {
      return;
    }

    const content = extractWeixinMessageText(message);
    if (!content) {
      return;
    }

    const contextToken = message.context_token?.trim();
    if (contextToken) {
      setWeixinContextToken(account.accountId, senderId, contextToken);
      void this.typingController.start({
        accountId: account.accountId,
        userId: senderId,
        contextToken,
        baseUrl: account.baseUrl,
        token: account.token,
      });
    }

    await this.handleMessage({
      senderId,
      chatId: senderId,
      content,
      metadata: {
        accountId: account.accountId,
        account_id: account.accountId,
        message_id: message.message_id ? String(message.message_id) : undefined,
        context_token: contextToken,
      },
    });
  };

  private resolveAccountIdFromMetadata = (metadata: Record<string, unknown>): string | undefined => {
    const requestedAccountId =
      typeof metadata.accountId === "string" && metadata.accountId.trim().length > 0
        ? metadata.accountId
        : typeof metadata.account_id === "string" && metadata.account_id.trim().length > 0
          ? metadata.account_id
          : null;
    return resolveWeixinAccountSelection(
      this.pluginConfig,
      Array.from(new Set([...resolveConfiguredWeixinAccountIds(this.pluginConfig), ...listStoredWeixinAccountIds()])),
      requestedAccountId,
    );
  };
}
