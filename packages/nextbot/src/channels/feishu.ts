import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import * as Lark from "@larksuiteoapi/node-sdk";

const MSG_TYPE_MAP: Record<string, string> = {
  image: "[image]",
  audio: "[audio]",
  file: "[file]",
  sticker: "[sticker]"
};

const TABLE_RE = /((?:^[ \t]*\|.+\|[ \t]*\n)(?:^[ \t]*\|[-:\s|]+\|[ \t]*\n)(?:^[ \t]*\|.+\|[ \t]*\n?)+)/gm;

export class FeishuChannel extends BaseChannel<Config["channels"]["feishu"]> {
  name = "feishu";
  private client: Lark.Client | null = null;
  private wsClient: Lark.WSClient | null = null;
  private processedMessageIds: string[] = [];
  private processedSet: Set<string> = new Set();

  constructor(config: Config["channels"]["feishu"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    if (!this.config.appId || !this.config.appSecret) {
      throw new Error("Feishu appId/appSecret not configured");
    }

    this.running = true;
    this.client = new Lark.Client({ appId: this.config.appId, appSecret: this.config.appSecret });

    const dispatcher = new Lark.EventDispatcher({
      encryptKey: this.config.encryptKey || undefined,
      verificationToken: this.config.verificationToken || undefined
    }).register({
      "im.message.receive_v1": async (data: Record<string, unknown>) => {
        await this.handleIncoming(data);
      }
    });

    this.wsClient = new Lark.WSClient({
      appId: this.config.appId,
      appSecret: this.config.appSecret,
      loggerLevel: Lark.LoggerLevel.info
    });

    this.wsClient.start({ eventDispatcher: dispatcher });
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.client) {
      return;
    }
    const receiveIdType = msg.chatId.startsWith("oc_") ? "chat_id" : "open_id";
    const elements = buildCardElements(msg.content ?? "");
    const card = {
      config: { wide_screen_mode: true },
      elements
    };
    const content = JSON.stringify(card);
    await this.client.im.message.create({
      params: { receive_id_type: receiveIdType },
      data: {
        receive_id: msg.chatId,
        msg_type: "interactive",
        content
      }
    });
  }

  private async handleIncoming(data: Record<string, unknown>): Promise<void> {
    const message = (data.message ?? {}) as Record<string, unknown>;
    const sender = (message.sender ?? data.sender ?? {}) as Record<string, unknown>;
    const senderIdObj = (sender.sender_id as Record<string, unknown> | undefined) ?? {};
    const senderId =
      (senderIdObj.open_id as string | undefined) ||
      (senderIdObj.user_id as string | undefined) ||
      (senderIdObj.union_id as string | undefined) ||
      (sender.open_id as string | undefined) ||
      (sender.user_id as string | undefined) ||
      "";

    const senderType = (sender.sender_type as string | undefined) ?? (sender.senderType as string | undefined);
    if (senderType === "bot") {
      return;
    }

    const chatId = (message.chat_id as string | undefined) ?? "";
    const chatType = (message.chat_type as string | undefined) ?? "";
    const msgType = (message.msg_type as string | undefined) ?? (message.message_type as string | undefined) ?? "";
    const messageId = (message.message_id as string | undefined) ?? "";

    if (!senderId || !chatId) {
      return;
    }
    if (!this.isAllowed(String(senderId))) {
      return;
    }

    if (messageId && this.isDuplicate(messageId)) {
      return;
    }

    if (messageId) {
      await this.addReaction(messageId, "THUMBSUP");
    }

    let content = "";
    if (message.content) {
      try {
        const parsed = JSON.parse(String(message.content));
        content = String(parsed.text ?? parsed.content ?? "");
      } catch {
        content = String(message.content);
      }
    }

    if (!content && MSG_TYPE_MAP[msgType]) {
      content = MSG_TYPE_MAP[msgType];
    }

    if (!content) {
      return;
    }

    const replyTo = chatType === "group" ? chatId : String(senderId);

    await this.handleMessage({
      senderId: String(senderId),
      chatId: replyTo,
      content,
      media: [],
      metadata: {
        message_id: messageId,
        chat_type: chatType,
        msg_type: msgType
      }
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

  private async addReaction(messageId: string, emojiType: string): Promise<void> {
    if (!this.client) {
      return;
    }
    try {
      await this.client.im.messageReaction.create({
        path: { message_id: messageId },
        data: { reaction_type: { emoji_type: emojiType } }
      });
    } catch {
      // ignore reaction errors
    }
  }
}

function buildCardElements(content: string): Array<Record<string, unknown>> {
  const elements: Array<Record<string, unknown>> = [];
  let lastEnd = 0;
  for (const match of content.matchAll(TABLE_RE)) {
    const start = match.index ?? 0;
    const tableText = match[1] ?? "";
    const before = content.slice(lastEnd, start).trim();
    if (before) {
      elements.push({ tag: "markdown", content: before });
    }
    elements.push(parseMdTable(tableText) ?? { tag: "markdown", content: tableText });
    lastEnd = start + tableText.length;
  }
  const remaining = content.slice(lastEnd).trim();
  if (remaining) {
    elements.push({ tag: "markdown", content: remaining });
  }
  if (!elements.length) {
    elements.push({ tag: "markdown", content });
  }
  return elements;
}

function parseMdTable(tableText: string): Record<string, unknown> | null {
  const lines = tableText
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 3) {
    return null;
  }
  const split = (line: string) => line.replace(/^\|+|\|+$/g, "").split("|").map((item) => item.trim());
  const headers = split(lines[0]);
  const rows = lines.slice(2).map(split);
  const columns = headers.map((header, index) => ({
    tag: "column",
    name: `c${index}`,
    display_name: header,
    width: "auto"
  }));
  const tableRows = rows.map((row) => {
    const values: Record<string, string> = {};
    headers.forEach((_, index) => {
      values[`c${index}`] = row[index] ?? "";
    });
    return values;
  });
  return {
    tag: "table",
    page_size: rows.length + 1,
    columns,
    rows: tableRows
  };
}
