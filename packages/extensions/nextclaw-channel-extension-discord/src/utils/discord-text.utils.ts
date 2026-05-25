import type { Config, InboundAttachment } from "@nextclaw/core";
import {
    type Message as DiscordMessage,
    type TextBasedChannel,
    type TextBasedChannelFields
} from "discord.js";

export const DISCORD_TEXT_LIMIT = 2000;
export const DISCORD_MAX_LINES_PER_MESSAGE = 17;
export const STREAM_MAX_UPDATES_PER_MESSAGE = 40;

const FENCE_RE = /^( {0,3})(`{3,}|~{3,})(.*)$/;

type OpenFence = {
    indent: string;
    markerChar: string;
    markerLen: number;
    openLine: string;
};

export type DraftChunkConfig = {
    minChars: number;
    maxChars: number;
    breakPreference: "paragraph" | "line" | "none";
};

export type DiscordStreamMode = "off" | "partial" | "block";

export function sanitizeAttachmentName(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, "_");
}

export function guessMimeFromName(name: string): string | null {
    const lower = name.toLowerCase();
    if (lower.endsWith(".png"))
        return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
        return "image/jpeg";
    if (lower.endsWith(".gif"))
        return "image/gif";
    if (lower.endsWith(".webp"))
        return "image/webp";
    if (lower.endsWith(".bmp"))
        return "image/bmp";
    if (lower.endsWith(".tif") || lower.endsWith(".tiff"))
        return "image/tiff";
    return null;
}

export function buildAttachmentSummary(attachments: InboundAttachment[]): string {
    const count = attachments.length;
    if (count === 0) {
        return "";
    }
    const allImages = attachments.every((entry) => isImageAttachment(entry));
    if (allImages) {
        return `<media:image> (${count} ${count === 1 ? "image" : "images"})`;
    }
    return `<media:document> (${count} ${count === 1 ? "file" : "files"})`;
}

export function chunkDiscordText(text: string, opts: {
    maxChars?: number;
    maxLines?: number;
} = {}): string[] {
    const maxChars = Math.max(1, Math.floor(opts.maxChars ?? DISCORD_TEXT_LIMIT));
    const maxLines = Math.max(1, Math.floor(opts.maxLines ?? DISCORD_MAX_LINES_PER_MESSAGE));
    const body = text ?? "";
    if (!body) {
        return [];
    }
    if (body.length <= maxChars && countLines(body) <= maxLines) {
        return [body];
    }
    return new DiscordTextChunker({ maxChars, maxLines }).chunk(body);
}

export function resolveTextChunkLimit(config: Config["channels"]["discord"]): number {
    const configured = typeof config.textChunkLimit === "number" ? config.textChunkLimit : DISCORD_TEXT_LIMIT;
    return clampInt(configured, 1, DISCORD_TEXT_LIMIT);
}

export function resolveDiscordStreamingMode(config: Config["channels"]["discord"]): DiscordStreamMode {
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

export function resolveDraftChunkConfig(
    config: Config["channels"]["discord"],
    textChunkLimit: number
): DraftChunkConfig {
    const raw = config.draftChunk ?? {};
    const minChars = clampInt((raw as DraftChunkConfig).minChars ?? 200, 1, textChunkLimit);
    const maxChars = clampInt((raw as DraftChunkConfig).maxChars ?? 800, minChars, textChunkLimit);
    const breakPreference = (raw as DraftChunkConfig).breakPreference === "line" || (raw as DraftChunkConfig).breakPreference === "none"
        ? (raw as DraftChunkConfig).breakPreference
        : "paragraph";
    return { minChars, maxChars, breakPreference };
}

export async function sendDiscordChunks(params: {
    textChannel: TextBasedChannel & TextBasedChannelFields;
    chunks: string[];
    replyTo?: string;
    flags?: number;
}): Promise<void> {
    const { textChannel, chunks, replyTo, flags } = params;
    let first = true;
    for (const chunk of chunks) {
        await sendDiscordSingleChunk({
            textChannel,
            chunk,
            replyTo: first ? replyTo : undefined,
            flags
        });
        first = false;
    }
}

class DiscordTextChunker {
    private readonly chunks: string[] = [];
    private current = "";
    private currentLines = 0;
    private openFence: OpenFence | null = null;

    constructor(private readonly limits: {
        maxChars: number;
        maxLines: number;
    }) { }

    chunk = (body: string): string[] => {
        for (const line of body.split("\n")) {
            this.appendLine(line);
        }
        this.flush();
        return this.chunks;
    };

    private appendLine = (line: string): void => {
        const fenceInfo = parseFenceLine(line);
        const wasInsideFence = this.openFence !== null;
        const nextOpenFence = this.nextFence(fenceInfo);
        const { charLimit, lineLimit } = this.resolveLimits(nextOpenFence);
        const prefixLength = this.current.length > 0 ? this.current.length + 1 : 0;
        const segments = splitLongLine(line, Math.max(1, charLimit - prefixLength), {
            preserveWhitespace: wasInsideFence
        });
        this.appendSegments({ segments, charLimit, lineLimit });
        this.openFence = nextOpenFence;
    };

    private appendSegments = (params: {
        segments: string[];
        charLimit: number;
        lineLimit: number;
    }): void => {
        const { segments, charLimit, lineLimit } = params;
        segments.forEach((segment, index) => {
            this.appendSegment({
                segment,
                isContinuation: index > 0,
                charLimit,
                lineLimit
            });
        });
    };

    private appendSegment = (params: {
        segment: string;
        isContinuation: boolean;
        charLimit: number;
        lineLimit: number;
    }): void => {
        const { segment, isContinuation, charLimit, lineLimit } = params;
        const delimiter = isContinuation ? "" : this.current.length > 0 ? "\n" : "";
        const addition = `${delimiter}${segment}`;
        const nextLength = this.current.length + addition.length;
        const nextLineCount = this.currentLines + (isContinuation ? 0 : 1);
        if ((nextLength > charLimit || nextLineCount > lineLimit) && this.current.length > 0) {
            this.flush();
        }
        this.addToCurrent(segment, addition, isContinuation);
    };

    private addToCurrent = (segment: string, addition: string, isContinuation: boolean): void => {
        if (this.current.length > 0) {
            this.current += addition;
            this.currentLines += isContinuation ? 0 : 1;
            return;
        }
        this.current = segment;
        this.currentLines = 1;
    };

    private nextFence = (fenceInfo: OpenFence | null): OpenFence | null => {
        if (!fenceInfo) {
            return this.openFence;
        }
        if (!this.openFence) {
            return fenceInfo;
        }
        const closesCurrent = this.openFence.markerChar === fenceInfo.markerChar &&
            fenceInfo.markerLen >= this.openFence.markerLen;
        return closesCurrent ? null : this.openFence;
    };

    private resolveLimits = (nextOpenFence: OpenFence | null): {
        charLimit: number;
        lineLimit: number;
    } => {
        const reserveChars = nextOpenFence ? closeFenceLine(nextOpenFence).length + 1 : 0;
        const reserveLines = nextOpenFence ? 1 : 0;
        return {
            charLimit: Math.max(1, this.limits.maxChars - reserveChars),
            lineLimit: Math.max(1, this.limits.maxLines - reserveLines)
        };
    };

    private flush = (): void => {
        if (!this.current) {
            return;
        }
        const payload = closeFenceIfNeeded(this.current, this.openFence);
        if (payload.trim().length) {
            this.chunks.push(payload);
        }
        this.current = "";
        this.currentLines = 0;
        if (this.openFence) {
            this.current = this.openFence.openLine;
            this.currentLines = 1;
        }
    };
}

function isImageAttachment(attachment: InboundAttachment): boolean {
    if (attachment.mimeType?.startsWith("image/")) {
        return true;
    }
    return Boolean(attachment.name && guessMimeFromName(attachment.name));
}

function countLines(text: string): number {
    if (!text) {
        return 0;
    }
    return text.split("\n").length;
}

function parseFenceLine(line: string): OpenFence | null {
    const match = line.match(FENCE_RE);
    if (!match) {
        return null;
    }
    const indent = match[1] ?? "";
    const marker = match[2] ?? "";
    return {
        indent,
        markerChar: marker[0] ?? "`",
        markerLen: marker.length,
        openLine: line
    };
}

function closeFenceLine(openFence: OpenFence): string {
    return `${openFence.indent}${openFence.markerChar.repeat(openFence.markerLen)}`;
}

function closeFenceIfNeeded(text: string, openFence: OpenFence | null): string {
    if (!openFence) {
        return text;
    }
    const closeLine = closeFenceLine(openFence);
    if (!text) {
        return closeLine;
    }
    if (!text.endsWith("\n")) {
        return `${text}\n${closeLine}`;
    }
    return `${text}${closeLine}`;
}

function splitLongLine(line: string, maxChars: number, opts: {
    preserveWhitespace: boolean;
}): string[] {
    const limit = Math.max(1, Math.floor(maxChars));
    if (line.length <= limit) {
        return [line];
    }
    return new LongLineSplitter({ line, limit, preserveWhitespace: opts.preserveWhitespace }).split();
}

class LongLineSplitter {
    private readonly chunks: string[] = [];

    private remaining: string;

    constructor(private readonly params: {
        line: string;
        limit: number;
        preserveWhitespace: boolean;
    }) {
        this.remaining = params.line;
    }

    split = (): string[] => {
        while (this.remaining.length > this.params.limit) {
            this.pushNextChunk();
        }
        if (this.remaining.length) {
            this.chunks.push(this.remaining);
        }
        return this.chunks;
    };

    private pushNextChunk = (): void => {
        if (this.params.preserveWhitespace) {
            this.chunks.push(this.remaining.slice(0, this.params.limit));
            this.remaining = this.remaining.slice(this.params.limit);
            return;
        }
        const breakIndex = this.resolveBreakIndex();
        this.chunks.push(this.remaining.slice(0, breakIndex));
        this.remaining = this.remaining.slice(breakIndex);
    };

    private resolveBreakIndex = (): number => {
        const window = this.remaining.slice(0, this.params.limit);
        for (let index = window.length - 1; index >= 0; index -= 1) {
            if (/\s/.test(window[index])) {
                return index > 0 ? index : this.params.limit;
            }
        }
        return this.params.limit;
    };
}

function clampInt(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) {
        return min;
    }
    return Math.min(max, Math.max(min, Math.floor(value)));
}

export async function sendDiscordSingleChunk(params: {
    textChannel: TextBasedChannel & TextBasedChannelFields;
    chunk: string;
    replyTo?: string;
    flags?: number;
}): Promise<DiscordMessage> {
    const { textChannel, chunk, replyTo, flags } = params;
    const payload: {
        content: string;
        reply?: {
            messageReference: string;
        };
        flags?: number;
    } = {
        content: chunk
    };
    if (replyTo) {
        payload.reply = { messageReference: replyTo };
    }
    if (flags !== undefined) {
        payload.flags = flags;
    }
    return await textChannel.send(payload as unknown as Parameters<TextBasedChannelFields["send"]>[0]) as DiscordMessage;
}
