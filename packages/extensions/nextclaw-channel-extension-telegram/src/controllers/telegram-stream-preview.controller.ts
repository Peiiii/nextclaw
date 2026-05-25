import type TelegramBot from "node-telegram-bot-api";
import type { OutboundMessage } from "@nextclaw/core";
import {
    TELEGRAM_TEXT_LIMIT,
    markdownToTelegramHtml,
    readReplyToMessageId,
    type TelegramStreamingMode
} from "../utils/telegram-message.utils.js";

const STREAM_PREVIEW_MIN_CHARS = 30;
const STREAM_PREVIEW_PARTIAL_MIN_INTERVAL_MS = 700;
const STREAM_PREVIEW_BLOCK_MIN_INTERVAL_MS = 1200;
const STREAM_PREVIEW_BLOCK_MIN_GROWTH = 120;

type TelegramStreamState = {
    chatId: string;
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

type PreviewPayload = {
    plainText: string;
    renderedText: string;
};

export class TelegramStreamPreviewController {
    private readonly states = new Map<string, TelegramStreamState>();

    constructor(private readonly params: {
        resolveMode: () => TelegramStreamingMode;
        getBot: () => TelegramBot | null;
    }) { }

    handleReset = async (msg: OutboundMessage): Promise<void> => {
        const chatId = String(msg.chatId);
        this.dispose(chatId);
        if (this.params.resolveMode() === "off") {
            return;
        }
        const replyToMessageId = readReplyToMessageId(msg.metadata);
        this.states.set(chatId, {
            chatId,
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
    };

    handleDelta = async (msg: OutboundMessage, delta: string): Promise<void> => {
        if (!delta || this.params.resolveMode() === "off") {
            return;
        }
        const chatId = String(msg.chatId);
        const state = this.ensureState(chatId);
        state.rawText += delta;
        this.scheduleFlush(state);
    };

    finalizeWithFinalMessage = async (msg: OutboundMessage): Promise<boolean> => {
        if (this.params.resolveMode() === "off") {
            return false;
        }
        const chatId = String(msg.chatId);
        const state = this.states.get(chatId);
        if (!state) {
            return false;
        }
        state.rawText = msg.content ?? "";
        state.silent = msg.metadata?.silent === true || state.silent;
        if (!state.rawText.trim()) {
            this.dispose(chatId);
            return false;
        }
        const handled = await this.flushNow(state, {
            force: true,
            allowInitialBelowThreshold: true,
            replyToMessageId: msg.replyTo ? Number(msg.replyTo) : state.replyToMessageId,
            silent: state.silent
        });
        this.dispose(chatId);
        return handled;
    };

    stopAll = (): void => {
        for (const chatId of this.states.keys()) {
            this.dispose(chatId);
        }
    };

    private ensureState = (chatId: string): TelegramStreamState => {
        const existing = this.states.get(chatId);
        if (existing) {
            return existing;
        }
        const created = createStreamState(chatId);
        this.states.set(chatId, created);
        return created;
    };

    private scheduleFlush = (state: TelegramStreamState): void => {
        if (state.timer) {
            return;
        }
        const minInterval = this.params.resolveMode() === "block"
            ? STREAM_PREVIEW_BLOCK_MIN_INTERVAL_MS
            : STREAM_PREVIEW_PARTIAL_MIN_INTERVAL_MS;
        const delay = Math.max(0, minInterval - (Date.now() - state.lastSentAt));
        state.timer = setTimeout(() => {
            state.timer = null;
            void this.flushScheduled(state);
        }, delay);
    };

    private flushScheduled = async (state: TelegramStreamState): Promise<void> => {
        const current = this.states.get(state.chatId);
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
        }
        finally {
            this.finishScheduledFlush(state);
        }
    };

    private finishScheduledFlush = (state: TelegramStreamState): void => {
        state.inFlight = false;
        if (state.pending) {
            state.pending = false;
            this.scheduleFlush(state);
        }
    };

    private flushNow = async (state: TelegramStreamState, opts: {
        force: boolean;
        allowInitialBelowThreshold: boolean;
        replyToMessageId?: number;
        silent: boolean;
    }): Promise<boolean> => {
        const bot = this.params.getBot();
        const payload = this.resolvePayload(state, opts);
        if (!bot || !payload) {
            return false;
        }
        if (typeof state.messageId === "number") {
            return this.editExistingPreview(bot, state, payload);
        }
        return this.sendNewPreview(bot, state, payload, opts);
    };

    private resolvePayload = (state: TelegramStreamState, opts: {
        force: boolean;
        allowInitialBelowThreshold: boolean;
    }): PreviewPayload | null => {
        const plainText = state.rawText.trimEnd();
        if (!this.shouldEmit(state, plainText, opts)) {
            return null;
        }
        const renderedText = markdownToTelegramHtml(plainText).trimEnd().slice(0, TELEGRAM_TEXT_LIMIT);
        if (!renderedText || renderedText === state.lastRenderedText) {
            return null;
        }
        return { plainText, renderedText };
    };

    private shouldEmit = (state: TelegramStreamState, plainText: string, opts: {
        force: boolean;
        allowInitialBelowThreshold: boolean;
    }): boolean => {
        if (!plainText) {
            return false;
        }
        const isBlockGrowthTooSmall = this.params.resolveMode() === "block" &&
            !opts.force &&
            plainText.length - state.lastEmittedChars < STREAM_PREVIEW_BLOCK_MIN_GROWTH;
        if (isBlockGrowthTooSmall) {
            return false;
        }
        if (typeof state.messageId === "number" || opts.allowInitialBelowThreshold) {
            return true;
        }
        return plainText.length >= STREAM_PREVIEW_MIN_CHARS;
    };

    private editExistingPreview = async (
        bot: TelegramBot,
        state: TelegramStreamState,
        payload: PreviewPayload
    ): Promise<boolean> => {
        try {
            await bot.editMessageText(payload.renderedText, {
                chat_id: Number(state.chatId),
                message_id: state.messageId,
                parse_mode: "HTML"
            });
        }
        catch {
            try {
                await bot.editMessageText(payload.plainText.slice(0, TELEGRAM_TEXT_LIMIT), {
                    chat_id: Number(state.chatId),
                    message_id: state.messageId
                });
            }
            catch {
                return false;
            }
        }
        this.recordPayload(state, payload);
        return true;
    };

    private sendNewPreview = async (
        bot: TelegramBot,
        state: TelegramStreamState,
        payload: PreviewPayload,
        opts: {
            replyToMessageId?: number;
            silent: boolean;
        }
    ): Promise<boolean> => {
        const sent = await this.sendPreviewMessage(bot, state.chatId, payload, opts);
        if (typeof sent.message_id === "number") {
            state.messageId = sent.message_id;
        }
        this.recordPayload(state, payload);
        return true;
    };

    private sendPreviewMessage = async (
        bot: TelegramBot,
        chatId: string,
        payload: PreviewPayload,
        opts: {
            replyToMessageId?: number;
            silent: boolean;
        }
    ): Promise<MessageWithId> => {
        try {
            return await bot.sendMessage(Number(chatId), payload.renderedText, {
                parse_mode: "HTML",
                ...(opts.replyToMessageId ? { reply_to_message_id: opts.replyToMessageId } : {}),
                ...(opts.silent ? { disable_notification: true } : {})
            });
        }
        catch {
            return bot.sendMessage(Number(chatId), payload.plainText.slice(0, TELEGRAM_TEXT_LIMIT), {
                ...(opts.replyToMessageId ? { reply_to_message_id: opts.replyToMessageId } : {}),
                ...(opts.silent ? { disable_notification: true } : {})
            });
        }
    };

    private recordPayload = (state: TelegramStreamState, payload: PreviewPayload): void => {
        state.lastRenderedText = payload.renderedText;
        state.lastSentAt = Date.now();
        state.lastEmittedChars = payload.plainText.length;
    };

    private dispose = (chatId: string): void => {
        const state = this.states.get(chatId);
        if (!state) {
            return;
        }
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        this.states.delete(chatId);
    };
}

type MessageWithId = {
    message_id?: number;
};

function createStreamState(chatId: string): TelegramStreamState {
    return {
        chatId,
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
}
