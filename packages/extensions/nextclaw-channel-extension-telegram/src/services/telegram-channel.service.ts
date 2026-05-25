import TelegramBot, { type Message, type BotCommand } from "node-telegram-bot-api";
import { APP_NAME, BaseChannel, getDataPath, isAssistantStreamResetControlMessage, isTypingStopControlMessage, readAssistantStreamDelta, type Config, type InboundAttachment, type MessageBus, type OutboundMessage, } from "@nextclaw/core";
import { ChannelTypingController, type ExtensionChannelCommands } from "@nextclaw/extension-sdk";
import { GroqTranscriptionProvider } from "../providers/groq-transcription.provider.js";
import { TelegramStreamPreviewController } from "../controllers/telegram-stream-preview.controller.js";
import {
    getExtension,
    inferMediaMimeType,
    isLocalTelegramCommand,
    markdownToTelegramHtml,
    resolveMedia,
    resolveSender,
    resolveTelegramStreamingMode,
    shouldSendAckReaction,
    toTelegramReaction,
    type TelegramMentionState
} from "../utils/telegram-message.utils.js";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
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
    private readonly streamPreview: TelegramStreamPreviewController;
    private transcriber: GroqTranscriptionProvider;
    constructor(config: Config["channels"]["telegram"], bus: MessageBus, private readonly commands?: ExtensionChannelCommands, groqApiKey?: string | null) {
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
    start = async (): Promise<void> => {
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
        }
        catch {
            this.botUserId = null;
            this.botUsername = null;
        }
        this.bot.onText(/^\/start$/, async (msg: Message) => {
            await this.bot?.sendMessage(msg.chat.id, `👋 Hi ${msg.from?.first_name ?? ""}! I'm ${APP_NAME}.\n\nSend me a message and I'll respond!\nType /help to see available commands.`);
        });
        this.bot.onText(/^\/help$/, async (msg: Message) => {
            const helpText = `🤖 <b>${APP_NAME} commands</b>\n\n` +
                "/start — Start the bot\n" +
                "/reset — Reset conversation history\n" +
                "/help — Show this help message\n\n" +
                "Just send me a text message to chat!";
            await this.bot?.sendMessage(msg.chat.id, helpText, { parse_mode: "HTML" });
        });
        this.bot.on("message", async (msg: Message) => {
            if (!msg.text && !msg.caption && !msg.photo && !msg.voice && !msg.audio && !msg.document) {
                return;
            }
            if (msg.text?.startsWith("/")) {
                if (!isLocalTelegramCommand(msg.text)) {
                    await this.handleTextCommand(msg);
                }
                return;
            }
            await this.handleIncoming(msg);
        });
        this.bot.on("channel_post", async (msg: Message) => {
            if (!msg.text && !msg.caption && !msg.photo && !msg.voice && !msg.audio && !msg.document) {
                return;
            }
            if (msg.text?.startsWith("/")) {
                if (!isLocalTelegramCommand(msg.text)) {
                    await this.handleTextCommand(msg);
                }
                return;
            }
            await this.handleIncoming(msg);
        });
        await this.bot.setMyCommands(BOT_COMMANDS);
    };
    stop = async (): Promise<void> => {
        this.running = false;
        this.typingController.stopAll();
        this.streamPreview.stopAll();
        if (this.bot) {
            await this.bot.stopPolling();
            this.bot = null;
        }
    };
    handleControlMessage = async (msg: OutboundMessage): Promise<boolean> => {
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
    };
    send = async (msg: OutboundMessage): Promise<void> => {
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
        const options = {
            parse_mode: "HTML" as const,
            ...(replyTo ? { reply_to_message_id: replyTo } : {}),
            ...(silent ? { disable_notification: true } : {})
        };
        try {
            await this.bot.sendMessage(Number(msg.chatId), htmlContent, options);
        }
        catch {
            await this.bot.sendMessage(Number(msg.chatId), msg.content ?? "", {
                ...(replyTo ? { reply_to_message_id: replyTo } : {}),
                ...(silent ? { disable_notification: true } : {})
            });
        }
    };
    private handleIncoming = async (message: Message): Promise<void> => {
        if (!this.bot) {
            return;
        }
        const context = this.resolveIncomingContext(message);
        if (!context) {
            return;
        }
        const { sender, senderId, chatId, isGroup, mentionState } = context;
        const { content, attachments } = await this.buildIncomingPayload(message);
        await this.maybeAddAckReaction({
            message,
            chatId,
            isGroup,
            mentionState
        });
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
        }
        catch (error) {
            this.stopTyping(chatId);
            throw error;
        }
    };
    private resolveIncomingContext = (message: Message): {
        sender: NonNullable<ReturnType<typeof resolveSender>>;
        senderId: string;
        chatId: string;
        isGroup: boolean;
        mentionState: TelegramMentionState;
    } | null => {
        const sender = resolveSender(message);
        if (!sender) {
            return null;
        }
        const chatId = String(message.chat.id);
        const isGroup = message.chat.type !== "private";
        if (!this.isAllowedByPolicy({ senderId: String(sender.id), chatId, isGroup })) {
            return null;
        }
        const mentionState = this.resolveMentionState({ message, chatId, isGroup });
        if (mentionState.requireMention && !mentionState.wasMentioned) {
            return null;
        }
        const senderId = sender.username ? `${sender.id}|${sender.username}` : String(sender.id);
        return { sender, senderId, chatId, isGroup, mentionState };
    };
    private buildIncomingPayload = async (message: Message): Promise<{
        content: string;
        attachments: InboundAttachment[];
    }> => {
        const contentParts = [message.text, message.caption].filter((part): part is string => Boolean(part));
        const attachments: InboundAttachment[] = [];
        const mediaPart = await this.resolveIncomingMediaPart(message);
        if (mediaPart) {
            contentParts.push(mediaPart.content);
            attachments.push(mediaPart.attachment);
        }
        return {
            content: contentParts.length ? contentParts.join("\n") : "[empty message]",
            attachments
        };
    };
    private resolveIncomingMediaPart = async (message: Message): Promise<{
        content: string;
        attachment: InboundAttachment;
    } | null> => {
        if (!this.bot) {
            return null;
        }
        const { fileId, mediaType, mimeType } = resolveMedia(message);
        if (!fileId || !mediaType) {
            return null;
        }
        const mediaDir = join(getDataPath(), "media");
        mkdirSync(mediaDir, { recursive: true });
        const extension = getExtension(mediaType, mimeType);
        const downloaded = await this.bot.downloadFile(fileId, mediaDir);
        const finalPath = extension && !downloaded.endsWith(extension) ? `${downloaded}${extension}` : downloaded;
        return {
            content: await this.renderMediaContent(mediaType, finalPath),
            attachment: {
                id: fileId,
                name: finalPath.split("/").pop(),
                path: finalPath,
                mimeType: mimeType ?? inferMediaMimeType(mediaType),
                source: "telegram",
                status: "ready"
            }
        };
    };
    private renderMediaContent = async (mediaType: string, finalPath: string): Promise<string> => {
        if (mediaType !== "voice" && mediaType !== "audio") {
            return `[${mediaType}: ${finalPath}]`;
        }
        const transcription = await this.transcriber.transcribe(finalPath);
        return transcription ? `[transcription: ${transcription}]` : `[${mediaType}: ${finalPath}]`;
    };
    private handleTextCommand = async (message: Message): Promise<void> => {
        if (!message.text || !this.commands) {
            return;
        }
        const sender = resolveSender(message);
        if (!sender) {
            return;
        }
        const result = await this.commands.executeText({
            rawText: message.text,
            conversationId: String(message.chat.id),
            senderId: String(sender.id),
            metadata: {
                message_id: message.message_id,
                user_id: sender.id,
                username: sender.username,
                account_id: this.resolveAccountId(),
                accountId: this.resolveAccountId(),
                is_group: message.chat.type !== "private",
            },
        });
        if (result?.content) {
            await this.bot?.sendMessage(message.chat.id, result.content);
        }
    };
    private dispatchToBus = async (senderId: string, chatId: string, content: string, attachments: InboundAttachment[], metadata: Record<string, unknown>): Promise<void> => {
        await this.handleMessage({ senderId, chatId, content, attachments, metadata });
    };
    private startTyping = (chatId: string): void => {
        this.typingController.start(chatId);
    };
    private stopTyping = (chatId: string): void => {
        this.typingController.stop(chatId);
    };
    private resolveAccountId = (): string => {
        const accountId = this.config.accountId?.trim();
        return accountId || "default";
    };
    private maybeAddAckReaction = async (params: {
        message: Message;
        chatId: string;
        isGroup: boolean;
        mentionState: TelegramMentionState;
    }): Promise<void> => {
        const { message, chatId, isGroup, mentionState } = params;
        if (!this.bot) {
            return;
        }
        if (typeof message.message_id !== "number") {
            return;
        }
        const emoji = (this.config.ackReaction ?? "👀").trim();
        if (!emoji) {
            return;
        }
        const shouldAck = shouldSendAckReaction({
            scope: this.config.ackReactionScope,
            isDirect: !isGroup,
            isGroup,
            requireMention: mentionState.requireMention,
            wasMentioned: mentionState.wasMentioned
        });
        if (!shouldAck) {
            return;
        }
        const reaction = toTelegramReaction(emoji);
        try {
            await this.bot.setMessageReaction(Number(chatId), message.message_id, {
                reaction
            });
        }
        catch {
            // ignore reaction errors
        }
    };
    private isAllowedByPolicy = (params: {
        senderId: string;
        chatId: string;
        isGroup: boolean;
    }): boolean => {
        const { senderId, chatId, isGroup } = params;
        if (!isGroup) {
            if (this.config.dmPolicy === "disabled") {
                return false;
            }
            const allowFrom = this.config.allowFrom ?? [];
            if (this.config.dmPolicy === "allowlist" || this.config.dmPolicy === "pairing") {
                return this.isAllowed(senderId);
            }
            if (allowFrom.includes("*")) {
                return true;
            }
            return allowFrom.length === 0 ? true : this.isAllowed(senderId);
        }
        if (this.config.groupPolicy === "disabled") {
            return false;
        }
        if (this.config.groupPolicy === "allowlist") {
            const allowFrom = this.config.groupAllowFrom ?? [];
            return allowFrom.includes("*") || allowFrom.includes(chatId);
        }
        return true;
    };
    private resolveMentionState = (params: {
        message: Message;
        chatId: string;
        isGroup: boolean;
    }): TelegramMentionState => {
        const { message, chatId, isGroup } = params;
        if (!isGroup) {
            return { wasMentioned: false, requireMention: false };
        }
        const groups = this.config.groups ?? {};
        const groupRule = groups[chatId] ?? groups["*"];
        const requireMention = groupRule?.requireMention ?? this.config.requireMention ?? false;
        if (!requireMention) {
            return { wasMentioned: false, requireMention: false };
        }
        const content = `${message.text ?? ""}\n${message.caption ?? ""}`.trim();
        const patterns = [
            ...(this.config.mentionPatterns ?? []),
            ...(groupRule?.mentionPatterns ?? [])
        ]
            .map((pattern) => pattern.trim())
            .filter(Boolean);
        const usernameMentioned = this.botUsername ? content.includes(`@${this.botUsername}`) : false;
        const replyToBot = Boolean(this.botUserId) &&
            Boolean(message.reply_to_message?.from) &&
            message.reply_to_message?.from?.id === this.botUserId;
        const patternMentioned = patterns.some((pattern) => {
            try {
                return new RegExp(pattern, "i").test(content);
            }
            catch {
                return content.toLowerCase().includes(pattern.toLowerCase());
            }
        });
        return {
            wasMentioned: usernameMentioned || replyToBot || patternMentioned,
            requireMention
        };
    };
}
