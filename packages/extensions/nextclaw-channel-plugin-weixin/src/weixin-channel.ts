import type { MessageBus } from "@nextclaw/core";
import { BaseChannel } from "@nextclaw/core";
import type { OutboundMessage } from "@nextclaw/core";
import { NcpReplyConsumer } from "@nextclaw/ncp-toolkit";
import type { ChatTarget, NcpReplyInput } from "@nextclaw/ncp-toolkit";
import {
  deleteWeixinCursor,
  loadWeixinCursor,
  saveWeixinCursor,
  listStoredWeixinAccountIds,
} from "./weixin-account.store.js";
import {
  extractWeixinMessageText,
  fetchWeixinConfig,
  fetchWeixinUpdates,
  isSyntheticWeixinAttachmentText,
  sendWeixinTyping,
} from "./weixin-api.client.js";
import type { WeixinMessage } from "./weixin-api.client.js";
import { setWeixinContextToken } from "./weixin-context-token.store.js";
import { resolveWeixinInboundAttachments } from "./weixin-inbound-media.service.js";
import { WeixinTypingController } from "./weixin-typing-controller.js";
import {
  resolveConfiguredWeixinAccountIds,
} from "./weixin-config.js";
import type { WeixinPluginConfig } from "./weixin-config.js";
import { WeixinChat } from "./weixin-chat.js";
import type { ResolvedWeixinAccountRuntime } from "./weixin-chat.js";

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

function isWeixinPollingSessionTimeout(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("weixin getupdates failed") &&
    (message.includes("errcode=-14") || message.includes("session timeout"))
  );
}

export class WeixinChannel extends BaseChannel<Record<string, unknown>> {
  private readonly pollTasks: Promise<void>[] = [];
  private readonly accountControllers = new Map<string, AbortController>();
  private readonly typingController: WeixinTypingController;
  private readonly chat: WeixinChat;
  private readonly replyConsumer: NcpReplyConsumer;

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
    this.chat = new WeixinChat({
      pluginConfig: this.pluginConfig,
      typingController: this.typingController,
    });
    this.replyConsumer = new NcpReplyConsumer(this.chat);
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
    const target = this.createChatTarget({
      conversationId: msg.chatId,
      metadata: msg.metadata,
    });
    await this.chat.sendPart(target, {
      type: "text",
      text: msg.content,
    });
    await this.chat.stopTyping(target);
  };

  consumeNcpReply = async (input: NcpReplyInput): Promise<void> => {
    await this.replyConsumer.consume(input);
  };

  private resolveAccountRuntime = (accountId: string): ResolvedWeixinAccountRuntime | null => {
    return this.chat.resolveAccountRuntime(accountId);
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
          if (isWeixinPollingSessionTimeout(error)) {
            deleteWeixinCursor(accountId);
            await sleep(1_000, signal);
            continue;
          }
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

    const attachments = await resolveWeixinInboundAttachments({
      message,
      baseUrl: account.baseUrl,
    });
    const extractedContent = extractWeixinMessageText(message);
    const content =
      attachments.length > 0 && isSyntheticWeixinAttachmentText(extractedContent)
        ? ""
        : extractedContent;
    if (!content && attachments.length === 0) {
      return;
    }

    const contextToken = message.context_token?.trim();
    const metadata = {
      accountId: account.accountId,
      account_id: account.accountId,
      context_token: contextToken,
    };

    if (contextToken) {
      setWeixinContextToken(account.accountId, senderId, contextToken);
      void this.chat.startTyping(this.createChatTarget({
        conversationId: senderId,
        accountId: account.accountId,
        metadata,
      }));
    }

    await this.handleMessage({
      senderId,
      chatId: senderId,
      content,
      attachments,
      metadata,
    });
  };

  private createChatTarget = (params: {
    conversationId: string;
    accountId?: string;
    metadata?: Record<string, unknown>;
  }): ChatTarget => {
    return {
      conversationId: params.conversationId,
      ...(params.accountId ? { accountId: params.accountId } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    };
  };
}
