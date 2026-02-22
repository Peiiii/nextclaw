import TelegramBot, { type Message, type BotCommand } from "node-telegram-bot-api";
import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { InboundAttachment, OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import type { SessionManager } from "../session/manager.js";
import { GroqTranscriptionProvider } from "../providers/transcription.js";
import { getDataPath } from "../utils/helpers.js";
import { APP_NAME } from "../config/brand.js";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { ChannelTypingController } from "./typing-controller.js";
import { isTypingStopControlMessage } from "@nextclaw/core";

const TYPING_HEARTBEAT_MS = 6000;
const TYPING_AUTO_STOP_MS = 120000;

const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Start the bot" },
  { command: "reset", description: "Reset conversation history" },
  { command: "help", description: "Show available commands" }
];

export class TelegramChannel extends BaseChannel<Config["channels"]["telegram"]> {
  name = "telegram";

  private bot: TelegramBot | null = null;
  private botUserId: number | null = null;
  private botUsername: string | null = null;
  private readonly typingController: ChannelTypingController;
  private transcriber: GroqTranscriptionProvider;

  constructor(
    config: Config["channels"]["telegram"],
    bus: MessageBus,
    groqApiKey?: string,
    private sessionManager?: SessionManager
  ) {
    super(config, bus);
    this.transcriber = new GroqTranscriptionProvider(groqApiKey ?? null);
    this.typingController = new ChannelTypingController({
      heartbeatMs: TYPING_HEARTBEAT_MS,
      autoStopMs: TYPING_AUTO_STOP_MS,
      sendTyping: async (chatId) => {
        await this.bot?.sendChatAction(Number(chatId), "typing");
      }
    });
  }

  async start(): Promise<void> {
    if (!this.config.token) {
      throw new Error("Telegram bot token not configured");
    }

    this.running = true;
    const options: TelegramBot.ConstructorOptions = { polling: true };
    if (this.config.proxy) {
      options.request = { proxy: this.config.proxy } as TelegramBot.ConstructorOptions["request"];
    }
    this.bot = new TelegramBot(this.config.token, options);
    try {
      const me = await this.bot.getMe();
      this.botUserId = me.id;
      this.botUsername = me.username ?? null;
    } catch {
      this.botUserId = null;
      this.botUsername = null;
    }

    this.bot.onText(/^\/start$/, async (msg: Message) => {
      await this.bot?.sendMessage(
        msg.chat.id,
        `👋 Hi ${msg.from?.first_name ?? ""}! I'm ${APP_NAME}.\n\nSend me a message and I'll respond!\nType /help to see available commands.`
      );
    });

    this.bot.onText(/^\/help$/, async (msg: Message) => {
      const helpText =
        `🤖 <b>${APP_NAME} commands</b>\n\n` +
        "/start — Start the bot\n" +
        "/reset — Reset conversation history\n" +
        "/help — Show this help message\n\n" +
        "Just send me a text message to chat!";
      await this.bot?.sendMessage(msg.chat.id, helpText, { parse_mode: "HTML" });
    });

    this.bot.onText(/^\/reset$/, async (msg: Message) => {
      const chatId = String(msg.chat.id);
      if (!this.sessionManager) {
        await this.bot?.sendMessage(msg.chat.id, "⚠️ Session management is not available.");
        return;
      }
      const accountId = this.resolveAccountId();
      const candidates = this.sessionManager
        .listSessions()
        .filter((entry) => {
          const metadata = (entry.metadata as Record<string, unknown> | undefined) ?? {};
          const lastChannel = typeof metadata.last_channel === "string" ? metadata.last_channel : "";
          const lastTo = typeof metadata.last_to === "string" ? metadata.last_to : "";
          const lastAccountId =
            typeof metadata.last_account_id === "string"
              ? metadata.last_account_id
              : typeof metadata.last_accountId === "string"
                ? metadata.last_accountId
                : "default";
          return lastChannel === this.name && lastTo === chatId && lastAccountId === accountId;
        })
        .map((entry) => String(entry.key ?? ""))
        .filter(Boolean);

      let totalCleared = 0;
      for (const key of candidates) {
        const session = this.sessionManager.getIfExists(key);
        if (!session) {
          continue;
        }
        totalCleared += session.messages.length;
        this.sessionManager.clear(session);
        this.sessionManager.save(session);
      }

      if (candidates.length === 0) {
        const legacySession = this.sessionManager.getOrCreate(`${this.name}:${chatId}`);
        totalCleared = legacySession.messages.length;
        this.sessionManager.clear(legacySession);
        this.sessionManager.save(legacySession);
      }

      await this.bot?.sendMessage(msg.chat.id, `🔄 Conversation history cleared (${totalCleared} messages).`);
    });

    this.bot.on("message", async (msg: Message) => {
      if (!msg.text && !msg.caption && !msg.photo && !msg.voice && !msg.audio && !msg.document) {
        return;
      }
      if (msg.text?.startsWith("/")) {
        return;
      }
      await this.handleIncoming(msg);
    });

    this.bot.on("channel_post", async (msg: Message) => {
      if (!msg.text && !msg.caption && !msg.photo && !msg.voice && !msg.audio && !msg.document) {
        return;
      }
      if (msg.text?.startsWith("/")) {
        return;
      }
      await this.handleIncoming(msg);
    });

    await this.bot.setMyCommands(BOT_COMMANDS);
  }

  async stop(): Promise<void> {
    this.running = false;
    this.typingController.stopAll();
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot = null;
    }
  }

  async handleControlMessage(msg: OutboundMessage): Promise<boolean> {
    if (!isTypingStopControlMessage(msg)) {
      return false;
    }
    this.stopTyping(msg.chatId);
    return true;
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (isTypingStopControlMessage(msg)) {
      this.stopTyping(msg.chatId);
      return;
    }
    if (!this.bot) {
      return;
    }
    this.stopTyping(msg.chatId);
    const htmlContent = markdownToTelegramHtml(msg.content ?? "");
    const silent = msg.metadata?.silent === true;
    const replyTo = msg.replyTo ? Number(msg.replyTo) : undefined;
    const options = {
      parse_mode: "HTML" as const,
      ...(replyTo ? { reply_to_message_id: replyTo } : {}),
      ...(silent ? { disable_notification: true } : {})
    };
    try {
      await this.bot.sendMessage(Number(msg.chatId), htmlContent, options);
    } catch {
      await this.bot.sendMessage(Number(msg.chatId), msg.content ?? "", {
        ...(replyTo ? { reply_to_message_id: replyTo } : {}),
        ...(silent ? { disable_notification: true } : {})
      });
    }
  }

  private async handleIncoming(message: Message): Promise<void> {
    if (!this.bot) {
      return;
    }
    const sender = resolveSender(message);
    if (!sender) {
      return;
    }
    const chatId = String(message.chat.id);
    const isGroup = message.chat.type !== "private";
    if (!this.isAllowedByPolicy({ senderId: String(sender.id), chatId, isGroup })) {
      return;
    }
    const mentionState = this.resolveMentionState({ message, chatId, isGroup });
    if (mentionState.requireMention && !mentionState.wasMentioned) {
      return;
    }
    let senderId = String(sender.id);
    if (sender.username) {
      senderId = `${senderId}|${sender.username}`;
    }

    const contentParts: string[] = [];
    const attachments: InboundAttachment[] = [];

    if (message.text) {
      contentParts.push(message.text);
    }
    if (message.caption) {
      contentParts.push(message.caption);
    }

    const { fileId, mediaType, mimeType } = resolveMedia(message);
    if (fileId && mediaType) {
      const mediaDir = join(getDataPath(), "media");
      mkdirSync(mediaDir, { recursive: true });
      const extension = getExtension(mediaType, mimeType);
      const downloaded = await this.bot.downloadFile(fileId, mediaDir);
      const finalPath = extension && !downloaded.endsWith(extension) ? `${downloaded}${extension}` : downloaded;
      attachments.push({
        id: fileId,
        name: finalPath.split("/").pop(),
        path: finalPath,
        mimeType: mimeType ?? inferMediaMimeType(mediaType),
        source: "telegram",
        status: "ready"
      });

      if (mediaType === "voice" || mediaType === "audio") {
        const transcription = await this.transcriber.transcribe(finalPath);
        if (transcription) {
          contentParts.push(`[transcription: ${transcription}]`);
        } else {
          contentParts.push(`[${mediaType}: ${finalPath}]`);
        }
      } else {
        contentParts.push(`[${mediaType}: ${finalPath}]`);
      }
    }

    const content = contentParts.length ? contentParts.join("\n") : "[empty message]";
    this.startTyping(chatId);

    try {
      await this.dispatchToBus(senderId, chatId, content, attachments, {
        message_id: message.message_id,
        user_id: sender.id,
        username: sender.username,
        first_name: sender.firstName,
        sender_type: sender.type,
        is_bot: sender.isBot,
        is_group: isGroup,
        account_id: this.resolveAccountId(),
        accountId: this.resolveAccountId(),
        peer_kind: isGroup ? "group" : "direct",
        peer_id: isGroup ? chatId : String(sender.id),
        was_mentioned: mentionState.wasMentioned,
        require_mention: mentionState.requireMention
      });
    } catch (error) {
      this.stopTyping(chatId);
      throw error;
    }
  }

  private async dispatchToBus(
    senderId: string,
    chatId: string,
    content: string,
    attachments: InboundAttachment[],
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.handleMessage({ senderId, chatId, content, attachments, metadata });
  }

  private startTyping(chatId: string): void {
    this.typingController.start(chatId);
  }

  private stopTyping(chatId: string): void {
    this.typingController.stop(chatId);
  }

  private resolveAccountId(): string {
    const accountId = this.config.accountId?.trim();
    return accountId || "default";
  }

  private isAllowedByPolicy(params: { senderId: string; chatId: string; isGroup: boolean }): boolean {
    if (!params.isGroup) {
      if (this.config.dmPolicy === "disabled") {
        return false;
      }
      const allowFrom = this.config.allowFrom ?? [];
      if (this.config.dmPolicy === "allowlist" || this.config.dmPolicy === "pairing") {
        return this.isAllowed(params.senderId);
      }
      if (allowFrom.includes("*")) {
        return true;
      }
      return allowFrom.length === 0 ? true : this.isAllowed(params.senderId);
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
    message: Message;
    chatId: string;
    isGroup: boolean;
  }): { wasMentioned: boolean; requireMention: boolean } {
    if (!params.isGroup) {
      return { wasMentioned: false, requireMention: false };
    }
    const groups = this.config.groups ?? {};
    const groupRule = groups[params.chatId] ?? groups["*"];
    const requireMention = groupRule?.requireMention ?? this.config.requireMention ?? false;
    if (!requireMention) {
      return { wasMentioned: false, requireMention: false };
    }

    const content = `${params.message.text ?? ""}\n${params.message.caption ?? ""}`.trim();
    const patterns = [
      ...(this.config.mentionPatterns ?? []),
      ...(groupRule?.mentionPatterns ?? [])
    ]
      .map((pattern) => pattern.trim())
      .filter(Boolean);
    const usernameMentioned = this.botUsername ? content.includes(`@${this.botUsername}`) : false;
    const replyToBot =
      Boolean(this.botUserId) &&
      Boolean(params.message.reply_to_message?.from) &&
      params.message.reply_to_message?.from?.id === this.botUserId;
    const patternMentioned = patterns.some((pattern) => {
      try {
        return new RegExp(pattern, "i").test(content);
      } catch {
        return content.toLowerCase().includes(pattern.toLowerCase());
      }
    });

    return {
      wasMentioned: usernameMentioned || replyToBot || patternMentioned,
      requireMention
    };
  }
}

function resolveSender(message: Message): {
  id: number;
  username?: string;
  firstName?: string;
  isBot: boolean;
  type: "user" | "sender_chat";
} | null {
  if (message.from) {
    return {
      id: message.from.id,
      username: message.from.username,
      firstName: message.from.first_name,
      isBot: Boolean(message.from.is_bot),
      type: "user"
    };
  }
  if (message.sender_chat) {
    return {
      id: message.sender_chat.id,
      username: message.sender_chat.username,
      firstName: message.sender_chat.title,
      isBot: true,
      type: "sender_chat"
    };
  }
  return null;
}

function resolveMedia(message: Message): { fileId?: string; mediaType?: string; mimeType?: string } {
  if (message.photo?.length) {
    const photo = message.photo[message.photo.length - 1];
    return { fileId: photo.file_id, mediaType: "image", mimeType: "image/jpeg" };
  }
  if (message.voice) {
    return { fileId: message.voice.file_id, mediaType: "voice", mimeType: message.voice.mime_type };
  }
  if (message.audio) {
    return { fileId: message.audio.file_id, mediaType: "audio", mimeType: message.audio.mime_type };
  }
  if (message.document) {
    return { fileId: message.document.file_id, mediaType: "file", mimeType: message.document.mime_type };
  }
  return {};
}

function getExtension(mediaType: string, mimeType?: string | null): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/mp4": ".m4a"
  };
  if (mimeType && map[mimeType]) {
    return map[mimeType];
  }
  const fallback: Record<string, string> = {
    image: ".jpg",
    voice: ".ogg",
    audio: ".mp3",
    file: ""
  };
  return fallback[mediaType] ?? "";
}

function inferMediaMimeType(mediaType?: string): string | undefined {
  if (!mediaType) {
    return undefined;
  }
  if (mediaType === "image") {
    return "image/jpeg";
  }
  if (mediaType === "voice") {
    return "audio/ogg";
  }
  if (mediaType === "audio") {
    return "audio/mpeg";
  }
  return undefined;
}

function markdownToTelegramHtml(text: string): string {
  if (!text) {
    return "";
  }

  const codeBlocks: string[] = [];
  text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_m, code) => {
    codeBlocks.push(code);
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  const inlineCodes: string[] = [];
  text = text.replace(/`([^`]+)`/g, (_m, code) => {
    inlineCodes.push(code);
    return `\x00IC${inlineCodes.length - 1}\x00`;
  });

  text = text.replace(/^#{1,6}\s+(.+)$/gm, "$1");
  text = text.replace(/^>\s*(.*)$/gm, "$1");
  text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  text = text.replace(/__(.+?)__/g, "<b>$1</b>");
  text = text.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, "<i>$1</i>");
  text = text.replace(/~~(.+?)~~/g, "<s>$1</s>");
  text = text.replace(/^[-*]\s+/gm, "• ");

  inlineCodes.forEach((code, i) => {
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    text = text.replace(`\x00IC${i}\x00`, `<code>${escaped}</code>`);
  });

  codeBlocks.forEach((code, i) => {
    const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    text = text.replace(`\x00CB${i}\x00`, `<pre><code>${escaped}</code></pre>`);
  });

  return text;
}
