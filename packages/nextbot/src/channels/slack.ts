import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import { WebClient } from "@slack/web-api";
import { SocketModeClient } from "@slack/socket-mode";

export class SlackChannel extends BaseChannel<Config["channels"]["slack"]> {
  name = "slack";
  private webClient: WebClient | null = null;
  private socketClient: SocketModeClient | null = null;
  private botUserId: string | null = null;

  constructor(config: Config["channels"]["slack"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    if (!this.config.botToken || !this.config.appToken) {
      throw new Error("Slack bot/app token not configured");
    }
    if (this.config.mode !== "socket") {
      throw new Error(`Unsupported Slack mode: ${this.config.mode}`);
    }

    this.running = true;
    this.webClient = new WebClient(this.config.botToken);
    this.socketClient = new SocketModeClient({
      appToken: this.config.appToken
    });

    this.socketClient.on("events_api", async ({ body, ack }) => {
      await ack();
      await this.handleEvent(body?.event);
    });

    try {
      const auth = await this.webClient.auth.test();
      this.botUserId = auth.user_id ?? null;
    } catch {
      this.botUserId = null;
    }

    await this.socketClient.start();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.socketClient) {
      await this.socketClient.disconnect();
      this.socketClient = null;
    }
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.webClient) {
      return;
    }
    const slackMeta = (msg.metadata?.slack as Record<string, unknown>) ?? {};
    const threadTs = slackMeta.thread_ts as string | undefined;
    const channelType = slackMeta.channel_type as string | undefined;
    const useThread = Boolean(threadTs && channelType !== "im");
    await this.webClient.chat.postMessage({
      channel: msg.chatId,
      text: msg.content ?? "",
      thread_ts: useThread ? threadTs : undefined
    });
  }

  private async handleEvent(event: Record<string, unknown> | undefined): Promise<void> {
    if (!event) {
      return;
    }
    const eventType = event.type as string | undefined;
    if (eventType !== "message" && eventType !== "app_mention") {
      return;
    }

    if (event.subtype) {
      return;
    }

    const senderId = event.user as string | undefined;
    const chatId = event.channel as string | undefined;
    const channelType = (event.channel_type as string | undefined) ?? "";
    const text = (event.text as string | undefined) ?? "";

    if (!senderId || !chatId) {
      return;
    }
    if (this.botUserId && senderId === this.botUserId) {
      return;
    }
    if (eventType === "message" && this.botUserId && text.includes(`<@${this.botUserId}>`)) {
      return;
    }

    if (!this.isAllowedInSlack(senderId, chatId, channelType)) {
      return;
    }
    if (channelType !== "im" && !this.shouldRespondInChannel(eventType, text, chatId)) {
      return;
    }

    const cleanText = this.stripBotMention(text);
    const threadTs = (event.thread_ts as string | undefined) ?? (event.ts as string | undefined);

    try {
      if (this.webClient && event.ts) {
        await this.webClient.reactions.add({
          channel: chatId,
          name: "eyes",
          timestamp: event.ts as string
        });
      }
    } catch {
      // ignore reaction errors
    }

    await this.handleMessage({
      senderId,
      chatId,
      content: cleanText,
      media: [],
      metadata: {
        slack: {
          event,
          thread_ts: threadTs,
          channel_type: channelType
        }
      }
    });
  }

  private isAllowedInSlack(senderId: string, chatId: string, channelType: string): boolean {
    if (channelType === "im") {
      if (!this.config.dm.enabled) {
        return false;
      }
      if (this.config.dm.policy === "allowlist") {
        return this.config.dm.allowFrom.includes(senderId);
      }
      return true;
    }
    if (this.config.groupPolicy === "allowlist") {
      return this.config.groupAllowFrom.includes(chatId);
    }
    return true;
  }

  private shouldRespondInChannel(eventType: string, text: string, chatId: string): boolean {
    if (this.config.groupPolicy === "open") {
      return true;
    }
    if (this.config.groupPolicy === "mention") {
      if (eventType === "app_mention") {
        return true;
      }
      return this.botUserId ? text.includes(`<@${this.botUserId}>`) : false;
    }
    if (this.config.groupPolicy === "allowlist") {
      return this.config.groupAllowFrom.includes(chatId);
    }
    return false;
  }

  private stripBotMention(text: string): string {
    if (!text || !this.botUserId) {
      return text;
    }
    const pattern = new RegExp(`<@${this.botUserId}>\\s*`, "g");
    return text.replace(pattern, "").trim();
  }
}
