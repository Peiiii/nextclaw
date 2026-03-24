import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { InboundAttachment, OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import {
  buildFeishuCardElements,
  buildInboundMetadata,
  extractMessageInfo,
  extractMentions,
  extractSenderInfo,
  inferFeishuResourceMimeType
} from "./feishu-message-support.js";
import {
  buildFeishuConvertContext,
  convertFeishuMessageContent,
  getDefaultFeishuAccountId,
  getEnabledFeishuAccounts,
  LarkClient
} from "@nextclaw/feishu-core";

type ActiveFeishuAccount = {
  accountId: string;
  client: LarkClient;
  botOpenId?: string;
  botName?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export class FeishuChannel extends BaseChannel<Config["channels"]["feishu"]> {
  name = "feishu";
  private clients = new Map<string, ActiveFeishuAccount>();
  private processedMessageIds: string[] = [];
  private processedSet: Set<string> = new Set();

  constructor(config: Config["channels"]["feishu"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    const accounts = getEnabledFeishuAccounts(this.config);
    if (accounts.length === 0) {
      throw new Error("Feishu appId/appSecret not configured");
    }
    this.running = true;
    for (const account of accounts) {
      const client = LarkClient.fromAccount(account);
      const activeAccount: ActiveFeishuAccount = {
        accountId: account.accountId,
        client
      };
      const probe = await client.probe();
      if (probe.ok) {
        activeAccount.botOpenId = probe.botOpenId;
        activeAccount.botName = probe.botName;
      }
      client.startWebsocket(async (data) => {
        await this.handleIncoming(account.accountId, data);
      });
      this.clients.set(account.accountId, activeAccount);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    for (const account of this.clients.values()) {
      account.client.closeWebsocket();
    }
    this.clients.clear();
  }

  async send(msg: OutboundMessage): Promise<void> {
    const account = this.resolveOutboundAccount(msg.metadata);
    if (!account) {
      return;
    }
    const receiveIdType = msg.chatId.startsWith("oc_") ? "chat_id" : "open_id";
    const elements = buildFeishuCardElements(msg.content ?? "");
    const card = {
      config: { wide_screen_mode: true },
      elements
    };
    const content = JSON.stringify(card);
    await account.client.sendInteractiveCard({
      receiveId: msg.chatId,
      receiveIdType,
      content
    });
  }

  private async handleIncoming(accountId: string, data: Record<string, unknown>): Promise<void> {
    const account = this.clients.get(accountId);
    if (!account) {
      return;
    }
    const root = isRecord(data.event) ? data.event : data;
    const message = (root.message ?? data.message ?? {}) as Record<string, unknown>;
    const sender = (root.sender ?? message.sender ?? data.sender ?? {}) as Record<string, unknown>;
    const senderInfo = extractSenderInfo(sender);
    if (senderInfo.senderType === "bot") {
      return;
    }
    const messageInfo = extractMessageInfo(message);
    if (!senderInfo.senderId || !messageInfo.chatId) {
      return;
    }
    if (!this.isAllowedByPolicy({ senderId: senderInfo.senderId, chatId: messageInfo.chatId, isGroup: messageInfo.isGroup })) {
      return;
    }
    if (messageInfo.messageId && this.isDuplicate(`${accountId}:${messageInfo.messageId}`)) {
      return;
    }
    if (messageInfo.messageId) {
      await this.addReaction(account, messageInfo.messageId, "THUMBSUP");
    }
    const mentions = extractMentions(root, message);
    const mentionState = this.resolveMentionState({
      account,
      mentions,
      chatId: messageInfo.chatId,
      isGroup: messageInfo.isGroup,
      rawContent: messageInfo.rawContent
    });
    if (mentionState.requireMention && !mentionState.wasMentioned) {
      return;
    }
    const payload = this.buildInboundPayload(account, messageInfo, mentions);
    if (!payload) {
      return;
    }
    await this.handleMessage({
      senderId: senderInfo.senderId,
      // Always route by Feishu chat_id so DM/group sessions are stable.
      chatId: messageInfo.chatId,
      content: payload.content,
      attachments: payload.attachments,
      metadata: buildInboundMetadata({
        accountId,
        messageInfo,
        senderInfo,
        mentionState
      })
    });
  }

  private isDuplicate(messageId: string): boolean {
    if (this.processedSet.has(messageId)) {
      return true;
    }
    this.processedSet.add(messageId);
    this.processedMessageIds.push(messageId);
    if (this.processedMessageIds.length > 1000) {
      const removed = this.processedMessageIds.splice(0, 500);
      for (const id of removed) {
        this.processedSet.delete(id);
      }
    }
    return false;
  }

  private async addReaction(account: ActiveFeishuAccount, messageId: string, emojiType: string): Promise<void> {
    try {
      await account.client.addReaction(messageId, emojiType);
    } catch {
      // ignore reaction errors
    }
  }

  private resolveOutboundAccount(metadata: Record<string, unknown> | undefined): ActiveFeishuAccount | null {
    const accountId =
      typeof metadata?.accountId === "string"
        ? metadata.accountId
        : typeof metadata?.account_id === "string"
          ? metadata.account_id
          : getDefaultFeishuAccountId(this.config);
    return this.clients.get(accountId) ?? this.clients.get(getDefaultFeishuAccountId(this.config)) ?? null;
  }

  private isAllowedByPolicy(params: { senderId: string; chatId: string; isGroup: boolean }): boolean {
    if (!params.isGroup) {
      if (this.config.dmPolicy === "disabled") {
        return false;
      }
      if (this.config.dmPolicy === "allowlist" || this.config.dmPolicy === "pairing") {
        return this.isAllowed(params.senderId);
      }
      const allowFrom = this.config.allowFrom ?? [];
      return allowFrom.length === 0 || allowFrom.includes("*") || this.isAllowed(params.senderId);
    }
    if (this.config.groupPolicy === "disabled") {
      return false;
    }
    if (this.config.groupPolicy === "allowlist") {
      const allowFrom = this.config.groupAllowFrom ?? [];
      return allowFrom.includes("*") || allowFrom.includes(params.chatId);
    }
    return true;
  }

  private resolveMentionState(params: {
    account: ActiveFeishuAccount;
    mentions: unknown[];
    chatId: string;
    isGroup: boolean;
    rawContent: string;
  }): { wasMentioned: boolean; requireMention: boolean } {
    if (!params.isGroup) {
      return { wasMentioned: false, requireMention: false };
    }
    const groupRule = this.config.groups?.[params.chatId] ?? this.config.groups?.["*"];
    const requireMention = groupRule?.requireMention ?? this.config.requireMention ?? false;
    if (!requireMention) {
      return { wasMentioned: false, requireMention: false };
    }
    const patterns = [...(this.config.mentionPatterns ?? []), ...(groupRule?.mentionPatterns ?? [])]
      .map((pattern) => pattern.trim())
      .filter(Boolean);
    const rawText = params.rawContent.toLowerCase();
    const mentionedByPattern = patterns.some((pattern) => {
      try {
        return new RegExp(pattern, "i").test(rawText);
      } catch {
        return rawText.includes(pattern.toLowerCase());
      }
    });
    const mentionedByIds = params.mentions.some((entry) => {
      if (!entry || typeof entry !== "object") {
        return false;
      }
      const mention = entry as { id?: unknown; name?: unknown; open_id?: unknown };
      const openId =
        (typeof mention.open_id === "string" ? mention.open_id : "") ||
        (mention.id && typeof mention.id === "object" && "open_id" in mention.id
          ? ((mention.id as { open_id?: unknown }).open_id as string | undefined) ?? ""
          : typeof mention.id === "string"
            ? mention.id
            : "");
      const name = typeof mention.name === "string" ? mention.name : "";
      return openId === params.account.botOpenId || (params.account.botName ? name === params.account.botName : false);
    });
    return {
      wasMentioned: mentionedByPattern || mentionedByIds,
      requireMention
    };
  }

  private convertResource(resource: {
    type: "audio" | "file" | "image" | "sticker";
    fileKey: string;
    fileName?: string;
    duration?: number;
  }): InboundAttachment {
    return {
      id: resource.fileKey,
      name: resource.fileName,
      source: "feishu",
      status: "remote-only",
      mimeType: inferFeishuResourceMimeType(resource.type),
      url: resource.fileKey
    };
  }

  private buildInboundPayload(
    account: ActiveFeishuAccount,
    messageInfo: {
      rawContent: string;
      msgType: string;
    },
    mentions: unknown[]
  ): { content: string; attachments: InboundAttachment[] } | null {
    const converted = convertFeishuMessageContent(
      messageInfo.rawContent,
      messageInfo.msgType,
      buildFeishuConvertContext({
        mentions,
        stripBotMentions: true,
        botOpenId: account.botOpenId,
        botName: account.botName
      })
    );
    const content = converted.content.trim();
    if (!content) {
      return null;
    }
    return {
      content,
      attachments: converted.resources.map((resource) => this.convertResource(resource))
    };
  }
}
