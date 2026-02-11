import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import { createOpenAPI, createWebsocket, AvailableIntentsEventsEnum } from "qq-bot-sdk";

export class QQChannel extends BaseChannel<Config["channels"]["qq"]> {
  name = "qq";
  private client: ReturnType<typeof createOpenAPI> | null = null;
  private ws: ReturnType<typeof createWebsocket> | null = null;
  private processedIds: string[] = [];
  private processedSet: Set<string> = new Set();

  constructor(config: Config["channels"]["qq"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.appId || !this.config.secret) {
      throw new Error("QQ appId/secret not configured");
    }

    const wsConfig = {
      appID: this.config.appId,
      token: this.config.secret,
      intents: [AvailableIntentsEventsEnum.GROUP_AND_C2C_EVENT]
    };

    this.client = createOpenAPI(wsConfig);
    this.ws = createWebsocket(wsConfig);

    this.ws.on(AvailableIntentsEventsEnum.GROUP_AND_C2C_EVENT, async (data: Record<string, unknown>) => {
      await this.handleIncoming(data);
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.ws) {
      this.ws.disconnect();
      this.ws = null;
    }
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.client) {
      return;
    }
    await this.client.c2cApi.postMessage(msg.chatId, {
      content: msg.content ?? "",
      msg_type: 0
    });
  }

  private async handleIncoming(data: Record<string, unknown>): Promise<void> {
    const payload = (data.msg as Record<string, unknown> | undefined) ?? {};
    const messageId = (payload.id as string | undefined) ?? "";
    if (messageId && this.isDuplicate(messageId)) {
      return;
    }

    const author = (payload.author as Record<string, unknown> | undefined) ?? {};
    const senderId =
      (author.user_openid as string | undefined) ||
      (author.id as string | undefined) ||
      "";

    const content = (payload.content as string | undefined)?.trim() ?? "";

    if (!senderId || !content) {
      return;
    }

    if (!this.isAllowed(senderId)) {
      return;
    }

    await this.handleMessage({
      senderId,
      chatId: senderId,
      content,
      media: [],
      metadata: {
        message_id: messageId
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
}
