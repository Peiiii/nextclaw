import TelegramBot, { type Message, type BotCommand } from "node-telegram-bot-api";
import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import type { SessionManager } from "../session/manager.js";
import { GroqTranscriptionProvider } from "../providers/transcription.js";
import { getDataPath } from "../utils/helpers.js";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Start the bot" },
  { command: "reset", description: "Reset conversation history" },
  { command: "help", description: "Show available commands" }
];

export class TelegramChannel extends BaseChannel<Config["channels"]["telegram"]> {
  name = "telegram";

  private bot: TelegramBot | null = null;
  private typingTasks: Map<string, NodeJS.Timeout> = new Map();
  private transcriber: GroqTranscriptionProvider;

  constructor(
    config: Config["channels"]["telegram"],
    bus: MessageBus,
    groqApiKey?: string,
    private sessionManager?: SessionManager
  ) {
    super(config, bus);
    this.transcriber = new GroqTranscriptionProvider(groqApiKey ?? null);
  }

  async start(): Promise<void> {
    if (!this.config.token) {
      throw new Error("Telegram bot token not configured");
    }

    this.running = true;
    this.bot = new TelegramBot(this.config.token, { polling: true });

    this.bot.onText(/^\/start$/, async (msg) => {
      await this.bot?.sendMessage(
        msg.chat.id,
        `👋 Hi ${msg.from?.first_name ?? ""}! I'm nextbot.\n\nSend me a message and I'll respond!\nType /help to see available commands.`
      );
    });

    this.bot.onText(/^\/help$/, async (msg) => {
      const helpText =
        "🤖 <b>nextbot commands</b>\n\n" +
        "/start — Start the bot\n" +
        "/reset — Reset conversation history\n" +
        "/help — Show this help message\n\n" +
        "Just send me a text message to chat!";
      await this.bot?.sendMessage(msg.chat.id, helpText, { parse_mode: "HTML" });
    });

    this.bot.onText(/^\/reset$/, async (msg) => {
      const chatId = String(msg.chat.id);
      if (!this.sessionManager) {
        await this.bot?.sendMessage(msg.chat.id, "⚠️ Session management is not available.");
        return;
      }
      const sessionKey = `${this.name}:${chatId}`;
      const session = this.sessionManager.getOrCreate(sessionKey);
      const count = session.messages.length;
      this.sessionManager.clear(session);
      this.sessionManager.save(session);
      await this.bot?.sendMessage(msg.chat.id, `🔄 Conversation history cleared (${count} messages).`);
    });

    this.bot.on("message", async (msg) => {
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
    for (const task of this.typingTasks.values()) {
      clearInterval(task);
    }
    this.typingTasks.clear();
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot = null;
    }
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.bot) {
      return;
    }
    this.stopTyping(msg.chatId);
    const htmlContent = markdownToTelegramHtml(msg.content ?? "");
    try {
      await this.bot.sendMessage(Number(msg.chatId), htmlContent, { parse_mode: "HTML" });
    } catch {
      await this.bot.sendMessage(Number(msg.chatId), msg.content ?? "");
    }
  }

  private async handleIncoming(message: Message): Promise<void> {
    if (!this.bot || !message.from) {
      return;
    }
    const chatId = String(message.chat.id);
    let senderId = String(message.from.id);
    if (message.from.username) {
      senderId = `${senderId}|${message.from.username}`;
    }

    const contentParts: string[] = [];
    const mediaPaths: string[] = [];

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
      mediaPaths.push(finalPath);

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

    await this.dispatchToBus(senderId, chatId, content, mediaPaths, {
      message_id: message.message_id,
      user_id: message.from.id,
      username: message.from.username,
      first_name: message.from.first_name,
      is_group: message.chat.type !== "private"
    });
  }

  private async dispatchToBus(
    senderId: string,
    chatId: string,
    content: string,
    media: string[],
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.handleMessage({ senderId, chatId, content, media, metadata });
  }

  private startTyping(chatId: string): void {
    this.stopTyping(chatId);
    if (!this.bot) {
      return;
    }
    const task = setInterval(() => {
      void this.bot?.sendChatAction(Number(chatId), "typing");
    }, 4000);
    this.typingTasks.set(chatId, task);
  }

  private stopTyping(chatId: string): void {
    const task = this.typingTasks.get(chatId);
    if (task) {
      clearInterval(task);
      this.typingTasks.delete(chatId);
    }
  }
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
