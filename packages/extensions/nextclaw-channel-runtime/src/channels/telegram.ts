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
import {
  isAssistantStreamResetControlMessage,
  isTypingStopControlMessage,
  readAssistantStreamDelta
} from "@nextclaw/core";

const TYPING_HEARTBEAT_MS = 6000;
const TYPING_AUTO_STOP_MS = 120000;
const TELEGRAM_TEXT_LIMIT = 4096;
const STREAM_PREVIEW_MIN_CHARS = 30;
const STREAM_PREVIEW_PARTIAL_MIN_INTERVAL_MS = 700;
const STREAM_PREVIEW_BLOCK_MIN_INTERVAL_MS = 1200;
const STREAM_PREVIEW_BLOCK_MIN_GROWTH = 120;

const BOT_COMMANDS: BotCommand[] = [
  { command: "start", description: "Start the bot" },
  { command: "reset", description: "Reset conversation history" },
  { command: "help", description: "Show available commands" }
];

type TelegramMentionState = { wasMentioned: boolean; requireMention: boolean };
type TelegramAckReactionScope = Config["channels"]["telegram"]["ackReactionScope"];
type TelegramStreamingMode = "off" | "partial" | "block";

type TelegramStreamState = {
  chatId: string;
  threadId?: number;
  rawText: string;
  lastRenderedText: string;
  messageId?: number;
  replyToMessageId?: number;
  silent: boolean;
  lastSentAt: number;
  lastEmittedChars: number;
  inFlight: boolean;
  pending: boolean;
  timer: ReturnType<typeof setTimeout> | null;
};

function streamStateKey(chatId: string, threadId?: string): string {
  return threadId ? `${chatId}:${threadId}` : chatId;
}

class TelegramStreamPreviewController {
  private readonly states = new Map<string, TelegramStreamState>();

  constructor(
    private readonly params: {
      resolveMode: () => TelegramStreamingMode;
      getBot: () => TelegramBot | null;
    }
  ) {}

  async handleReset(msg: OutboundMessage): Promise<void> {
    const chatId = String(msg.chatId);
    const threadId = msg.threadId;
    const key = streamStateKey(chatId, threadId);
    this.dispose(key);
    if (this.params.resolveMode() === "off") {
      return;
    }
    const replyToMessageId = readReplyToMessageId(msg.metadata);
    this.states.set(key, {
      chatId,
      threadId: threadId ? Number(threadId) : undefined,
      rawText: "",
      lastRenderedText: "",
      messageId: undefined,
      replyToMessageId,
      silent: msg.metadata?.silent === true,
      lastSentAt: 0,
      lastEmittedChars: 0,
      inFlight: false,
      pending: false,
      timer: null
    });
  }

  async handleDelta(msg: OutboundMessage, delta: string): Promise<void> {
    if (!delta) {
      return;
    }
    if (this.params.resolveMode() === "off") {
      return;
    }
    const chatId = String(msg.chatId);
    const key = streamStateKey(chatId, msg.threadId);
    const state = this.ensureState(chatId, msg.threadId);
    state.rawText += delta;
    this.scheduleFlush(key, state);
  }

  async finalizeWithFinalMessage(msg: OutboundMessage): Promise<boolean> {
    if (this.params.resolveMode() === "off") {
      return false;
    }
    const chatId = String(msg.chatId);
    const threadId = msg.threadId;
    const key = streamStateKey(chatId, threadId);
    const state = this.states.get(key);
    if (!state) {
      return false;
    }
    state.rawText = msg.content ?? "";
    const replyToMessageId = msg.replyTo ? Number(msg.replyTo) : state.replyToMessageId;
    state.silent = msg.metadata?.silent === true || state.silent;
    if (!state.rawText.trim()) {
      this.dispose(key);
      return false;
    }
    const handled = await this.flushNow(state, {
      force: true,
      allowInitialBelowThreshold: true,
      replyToMessageId,
      silent: state.silent
    });
    this.dispose(key);
    return handled;
  }

  stopAll(): void {
    for (const key of this.states.keys()) {
      this.dispose(key);
    }
  }

  private ensureState(chatId: string, threadId?: string): TelegramStreamState {
    const key = streamStateKey(chatId, threadId);
    const existing = this.states.get(key);
    if (existing) {
      return existing;
    }
    const created: TelegramStreamState = {
      chatId,
      threadId: threadId ? Number(threadId) : undefined,
      rawText: "",
      lastRenderedText: "",
      messageId: undefined,
      replyToMessageId: undefined,
      silent: false,
      lastSentAt: 0,
      lastEmittedChars: 0,
      inFlight: false,
      pending: false,
      timer: null
    };
    this.states.set(key, created);
    return created;
  }

  private scheduleFlush(key: string, state: TelegramStreamState): void {
    if (state.timer) {
      return;
    }
    const minInterval =
      this.params.resolveMode() === "block"
        ? STREAM_PREVIEW_BLOCK_MIN_INTERVAL_MS
        : STREAM_PREVIEW_PARTIAL_MIN_INTERVAL_MS;
    const delay = Math.max(0, minInterval - (Date.now() - state.lastSentAt));
    state.timer = setTimeout(() => {
      state.timer = null;
      void this.flushScheduled(key, state);
    }, delay);
  }

  private async flushScheduled(key: string, state: TelegramStreamState): Promise<void> {
    const current = this.states.get(key);
    if (current !== state) {
      return;
    }
    if (state.inFlight) {
      state.pending = true;
      return;
    }
    state.inFlight = true;
    try {
      await this.flushNow(state, {
        force: false,
        allowInitialBelowThreshold: false,
        replyToMessageId: state.replyToMessageId,
        silent: state.silent
      });
    } finally {
      state.inFlight = false;
      if (state.pending) {
        state.pending = false;
        this.scheduleFlush(key, state);
      }
    }
  }

  private async flushNow(
    state: TelegramStreamState,
    opts: {
      force: boolean;
      allowInitialBelowThreshold: boolean;
      replyToMessageId?: number;
      silent: boolean;
    }
  ): Promise<boolean> {
    const bot = this.params.getBot();
    if (!bot) {
      return false;
    }
    const plainText = state.rawText.trimEnd();
    if (!plainText) {
      return false;
    }
    const mode = this.params.resolveMode();
    if (
      mode === "block" &&
      !opts.force &&
      plainText.length - state.lastEmittedChars < STREAM_PREVIEW_BLOCK_MIN_GROWTH
    ) {
      return typeof state.messageId === "number";
    }
    if (
      typeof state.messageId !== "number" &&
      !opts.allowInitialBelowThreshold &&
      plainText.length < STREAM_PREVIEW_MIN_CHARS
    ) {
      return false;
    }
    const renderedText = markdownToTelegramHtml(plainText).trimEnd();
    if (!renderedText) {
      return false;
    }
    const limitedRenderedText = renderedText.slice(0, TELEGRAM_TEXT_LIMIT);
    if (limitedRenderedText === state.lastRenderedText) {
      return typeof state.messageId === "number";
    }

    if (typeof state.messageId === "number") {
      try {
        await bot.editMessageText(limitedRenderedText, {
          chat_id: Number(state.chatId),
          message_id: state.messageId,
          parse_mode: "HTML"
        });
      } catch {
        try {
          await bot.editMessageText(plainText.slice(0, TELEGRAM_TEXT_LIMIT), {
            chat_id: Number(state.chatId),
            message_id: state.messageId
          });
        } catch {
          return false;
        }
      }
      state.lastRenderedText = limitedRenderedText;
      state.lastSentAt = Date.now();
      state.lastEmittedChars = plainText.length;
      return true;
    }

    const sendOptions = {
      parse_mode: "HTML" as const,
      ...(state.threadId ? { message_thread_id: state.threadId } : {}),
      ...(opts.replyToMessageId ? { reply_to_message_id: opts.replyToMessageId } : {}),
      ...(opts.silent ? { disable_notification: true } : {})
    };
    try {
      const sent = await bot.sendMessage(Number(state.chatId), limitedRenderedText, sendOptions);
      if (typeof sent.message_id === "number") {
        state.messageId = sent.message_id;
      }
    } catch {
      const sent = await bot.sendMessage(Number(state.chatId), plainText.slice(0, TELEGRAM_TEXT_LIMIT), {
        ...(state.threadId ? { message_thread_id: state.threadId } : {}),
        ...(opts.replyToMessageId ? { reply_to_message_id: opts.replyToMessageId } : {}),
        ...(opts.silent ? { disable_notification: true } : {})
      });
      if (typeof sent.message_id === "number") {
        state.messageId = sent.message_id;
      }
    }

    state.lastRenderedText = limitedRenderedText;
    state.lastSentAt = Date.now();
    state.lastEmittedChars = plainText.length;
    return true;
  }

  private dispose(chatId: string): void {
    const state = this.states.get(chatId);
    if (!state) {
      return;
    }
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    this.states.delete(chatId);
  }
}

export class TelegramChannel extends BaseChannel<Config["channels"]["telegram"]> {
  name = "telegram";

  private bot: TelegramBot | null = null;
  private botUserId: number | null = null;
  private botUsername: string | null = null;
  private readonly typingController: ChannelTypingController;
  private readonly streamPreview: TelegramStreamPreviewController;
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
    this.streamPreview = new TelegramStreamPreviewController({
      resolveMode: () => resolveTelegramStreamingMode(this.config),
      getBot: () => this.bot
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
      const opts = threadSendOptions(msg);
      await this.bot?.sendMessage(
        msg.chat.id,
        `👋 Hi ${msg.from?.first_name ?? ""}! I'm ${APP_NAME}.\n\nSend me a message and I'll respond!\nType /help to see available commands.`,
        opts
      );
    });

    this.bot.onText(/^\/help$/, async (msg: Message) => {
      const helpText =
        `🤖 <b>${APP_NAME} commands</b>\n\n` +
        "/start — Start the bot\n" +
        "/reset — Reset conversation history\n" +
        "/help — Show this help message\n\n" +
        "Just send me a text message to chat!";
      const opts = { parse_mode: "HTML" as const, ...threadSendOptions(msg) };
      await this.bot?.sendMessage(msg.chat.id, helpText, opts);
    });

    this.bot.onText(/^\/reset$/, async (msg: Message) => {
      const chatId = String(msg.chat.id);
      const threadId = msg.message_thread_id != null ? String(msg.message_thread_id) : undefined;
      const opts = threadSendOptions(msg);
      if (!this.sessionManager) {
        await this.bot?.sendMessage(msg.chat.id, "⚠️ Session management is not available.", opts);
        return;
      }
      const accountId = this.resolveAccountId();
      const sessionPrefix = threadId ? `${this.name}:${chatId}:${threadId}` : `${this.name}:${chatId}`;
      const candidates = this.sessionManager
        .listSessions()
        .filter((entry) => {
          const key = String(entry.key ?? "");
          return key === sessionPrefix || key.startsWith(sessionPrefix + ":");
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
        const legacySession = this.sessionManager.getOrCreate(sessionPrefix);
        totalCleared = legacySession.messages.length;
        this.sessionManager.clear(legacySession);
        this.sessionManager.save(legacySession);
      }

      await this.bot?.sendMessage(msg.chat.id, `🔄 Conversation history cleared (${totalCleared} messages).`, opts);
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
    this.streamPreview.stopAll();
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot = null;
    }
  }

  async handleControlMessage(msg: OutboundMessage): Promise<boolean> {
    if (isTypingStopControlMessage(msg)) {
      this.stopTyping(msg.chatId);
      return true;
    }
    if (isAssistantStreamResetControlMessage(msg)) {
      await this.streamPreview.handleReset(msg);
      return true;
    }
    const delta = readAssistantStreamDelta(msg);
    if (delta !== null) {
      await this.streamPreview.handleDelta(msg, delta);
      return true;
    }
    return false;
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
    if (await this.streamPreview.finalizeWithFinalMessage(msg)) {
      return;
    }
    const htmlContent = markdownToTelegramHtml(msg.content ?? "");
    const silent = msg.metadata?.silent === true;
    const replyTo = msg.replyTo ? Number(msg.replyTo) : undefined;
    const threadId = msg.threadId ? Number(msg.threadId) : undefined;
    const options = {
      parse_mode: "HTML" as const,
      ...(threadId ? { message_thread_id: threadId } : {}),
      ...(replyTo ? { reply_to_message_id: replyTo } : {}),
      ...(silent ? { disable_notification: true } : {})
    };
    try {
      await this.bot.sendMessage(Number(msg.chatId), htmlContent, options);
    } catch {
      await this.bot.sendMessage(Number(msg.chatId), msg.content ?? "", {
        ...(threadId ? { message_thread_id: threadId } : {}),
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
    const threadId = message.message_thread_id != null ? String(message.message_thread_id) : undefined;
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

    await this.maybeAddAckReaction({
      message,
      chatId,
      isGroup,
      mentionState
    });

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
      }, threadId);
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
    metadata: Record<string, unknown>,
    threadId?: string
  ): Promise<void> {
    await this.handleMessage({ senderId, chatId, threadId, content, attachments, metadata });
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

  private async maybeAddAckReaction(params: {
    message: Message;
    chatId: string;
    isGroup: boolean;
    mentionState: TelegramMentionState;
  }): Promise<void> {
    if (!this.bot) {
      return;
    }
    if (typeof params.message.message_id !== "number") {
      return;
    }
    const emoji = (this.config.ackReaction ?? "👀").trim();
    if (!emoji) {
      return;
    }
    const shouldAck = shouldSendAckReaction({
      scope: this.config.ackReactionScope,
      isDirect: !params.isGroup,
      isGroup: params.isGroup,
      requireMention: params.mentionState.requireMention,
      wasMentioned: params.mentionState.wasMentioned
    });
    if (!shouldAck) {
      return;
    }
    const reaction = [{ type: "emoji", emoji } as TelegramBot.ReactionType];
    try {
      await this.bot.setMessageReaction(Number(params.chatId), params.message.message_id, {
        reaction
      });
    } catch {
      // ignore reaction errors
    }
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
  }): TelegramMentionState {
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

function shouldSendAckReaction(params: {
  scope?: TelegramAckReactionScope;
  isDirect: boolean;
  isGroup: boolean;
  requireMention: boolean;
  wasMentioned: boolean;
}): boolean {
  const scope = params.scope ?? "all";
  if (scope === "off") {
    return false;
  }
  if (scope === "all") {
    return true;
  }
  if (scope === "direct") {
    return params.isDirect;
  }
  if (scope === "group-all") {
    return params.isGroup;
  }
  if (scope === "group-mentions") {
    return params.isGroup && params.requireMention && params.wasMentioned;
  }
  return false;
}

function threadSendOptions(msg: Message): { message_thread_id?: number } {
  if (msg.message_thread_id != null && typeof msg.message_thread_id === "number") {
    return { message_thread_id: msg.message_thread_id };
  }
  return {};
}

function readReplyToMessageId(metadata: Record<string, unknown>): number | undefined {
  const raw = metadata.message_id;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }
  return undefined;
}

function resolveTelegramStreamingMode(config: Config["channels"]["telegram"]): TelegramStreamingMode {
  const raw = config.streaming;
  if (raw === true) {
    return "partial";
  }
  if (raw === false || raw === undefined || raw === null) {
    return "off";
  }
  if (raw === "progress") {
    return "partial";
  }
  if (raw === "partial" || raw === "block" || raw === "off") {
    return raw;
  }
  return "off";
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
