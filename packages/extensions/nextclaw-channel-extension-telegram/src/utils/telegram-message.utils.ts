import type TelegramBot from "node-telegram-bot-api";
import type { Message } from "node-telegram-bot-api";
import type { Config } from "@nextclaw/core";

export const TELEGRAM_TEXT_LIMIT = 4096;

export type TelegramMentionState = {
    wasMentioned: boolean;
    requireMention: boolean;
};

export type TelegramAckReactionScope = Config["channels"]["telegram"]["ackReactionScope"];

export type TelegramStreamingMode = "off" | "partial" | "block";

export function resolveSender(message: Message): {
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

export function isLocalTelegramCommand(text: string): boolean {
    return /^\/(?:start|help)(?:@\w+)?(?:\s|$)/i.test(text.trim());
}

export function resolveMedia(message: Message): {
    fileId?: string;
    mediaType?: string;
    mimeType?: string;
} {
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

export function getExtension(mediaType: string, mimeType?: string | null): string {
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

export function inferMediaMimeType(mediaType?: string): string | undefined {
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

export function shouldSendAckReaction(params: {
    scope?: TelegramAckReactionScope;
    isDirect: boolean;
    isGroup: boolean;
    requireMention: boolean;
    wasMentioned: boolean;
}): boolean {
    const { isDirect, isGroup, requireMention, wasMentioned } = params;
    const scope = params.scope ?? "all";
    if (scope === "off") {
        return false;
    }
    if (scope === "all") {
        return true;
    }
    if (scope === "direct") {
        return isDirect;
    }
    if (scope === "group-all") {
        return isGroup;
    }
    if (scope === "group-mentions") {
        return isGroup && requireMention && wasMentioned;
    }
    return false;
}

export function readReplyToMessageId(metadata: Record<string, unknown>): number | undefined {
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

export function resolveTelegramStreamingMode(config: Config["channels"]["telegram"]): TelegramStreamingMode {
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

export function markdownToTelegramHtml(text: string): string {
    if (!text) {
        return "";
    }
    const codeBlocks: string[] = [];
    let rendered = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_m, code) => {
        codeBlocks.push(code);
        return `\x00CB${codeBlocks.length - 1}\x00`;
    });
    const inlineCodes: string[] = [];
    rendered = rendered.replace(/`([^`]+)`/g, (_m, code) => {
        inlineCodes.push(code);
        return `\x00IC${inlineCodes.length - 1}\x00`;
    });
    rendered = rendered.replace(/^#{1,6}\s+(.+)$/gm, "$1");
    rendered = rendered.replace(/^>\s*(.*)$/gm, "$1");
    rendered = rendered.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    rendered = rendered.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    rendered = rendered.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    rendered = rendered.replace(/__(.+?)__/g, "<b>$1</b>");
    rendered = rendered.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, "<i>$1</i>");
    rendered = rendered.replace(/~~(.+?)~~/g, "<s>$1</s>");
    rendered = rendered.replace(/^[-*]\s+/gm, "• ");
    inlineCodes.forEach((code, i) => {
        const escaped = escapeTelegramHtml(code);
        rendered = rendered.replace(`\x00IC${i}\x00`, `<code>${escaped}</code>`);
    });
    codeBlocks.forEach((code, i) => {
        const escaped = escapeTelegramHtml(code);
        rendered = rendered.replace(`\x00CB${i}\x00`, `<pre><code>${escaped}</code></pre>`);
    });
    return rendered;
}

export function toTelegramReaction(emoji: string): TelegramBot.ReactionType[] {
    return [{ type: "emoji", emoji } as TelegramBot.ReactionType];
}

function escapeTelegramHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
