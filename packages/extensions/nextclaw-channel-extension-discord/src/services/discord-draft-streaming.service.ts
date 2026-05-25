import type { Message as DiscordMessage, TextBasedChannel, TextBasedChannelFields } from "discord.js";
import {
    STREAM_MAX_UPDATES_PER_MESSAGE,
    type DiscordStreamMode,
    type DraftChunkConfig,
    sendDiscordChunks,
    sendDiscordSingleChunk
} from "../utils/discord-text.utils.js";

const STREAM_EDIT_MIN_INTERVAL_MS = 600;

export async function sendDiscordDraftStreaming(params: {
    textChannel: TextBasedChannel & TextBasedChannelFields;
    chunks: string[];
    replyTo?: string;
    flags?: number;
    draftChunk: DraftChunkConfig;
    streamingMode: DiscordStreamMode;
}): Promise<void> {
    const sender = new DiscordDraftStreamingSender(params);
    await sender.send();
}

class DiscordDraftStreamingSender {
    private first = true;

    private readonly effectiveDraftChunk: DraftChunkConfig;

    constructor(private readonly params: {
        textChannel: TextBasedChannel & TextBasedChannelFields;
        chunks: string[];
        replyTo?: string;
        flags?: number;
        draftChunk: DraftChunkConfig;
        streamingMode: DiscordStreamMode;
    }) {
        this.effectiveDraftChunk = resolveEffectiveDraftChunk(params.draftChunk, params.streamingMode);
    }

    send = async (): Promise<void> => {
        for (const chunk of this.params.chunks) {
            await this.sendChunk(chunk);
        }
    };

    private sendChunk = async (chunk: string): Promise<void> => {
        const draftChunks = splitDraftChunks(chunk, this.effectiveDraftChunk);
        if (draftChunks.length === 0) {
            return;
        }
        if (draftChunks.length > STREAM_MAX_UPDATES_PER_MESSAGE) {
            await this.sendFallbackChunk(chunk);
            return;
        }
        await this.sendDraftParts(chunk, draftChunks);
    };

    private sendDraftParts = async (chunk: string, draftChunks: string[]): Promise<void> => {
        let draftMessage: DiscordMessage | null = null;
        let current = "";
        let lastEditAt = 0;
        for (const draftPart of draftChunks) {
            current += draftPart;
            if (!draftMessage) {
                draftMessage = await this.createDraftMessage(current);
                lastEditAt = Date.now();
                continue;
            }
            const edited = await this.editDraftMessage(draftMessage, current, lastEditAt);
            if (!edited) {
                await this.sendFallbackChunk(chunk);
                return;
            }
            lastEditAt = Date.now();
        }
    };

    private createDraftMessage = async (content: string): Promise<DiscordMessage> => {
        const message = await sendDiscordSingleChunk({
            textChannel: this.params.textChannel,
            chunk: content,
            replyTo: this.first ? this.params.replyTo : undefined,
            flags: this.params.flags
        });
        this.first = false;
        return message;
    };

    private editDraftMessage = async (
        draftMessage: DiscordMessage,
        content: string,
        lastEditAt: number
    ): Promise<boolean> => {
        const waitMs = Math.max(0, lastEditAt + STREAM_EDIT_MIN_INTERVAL_MS - Date.now());
        if (waitMs > 0) {
            await sleep(waitMs);
        }
        try {
            await draftMessage.edit({ content });
            return true;
        }
        catch {
            return false;
        }
    };

    private sendFallbackChunk = async (chunk: string): Promise<void> => {
        await sendDiscordChunks({
            textChannel: this.params.textChannel,
            chunks: [chunk],
            replyTo: this.first ? this.params.replyTo : undefined,
            flags: this.params.flags
        });
        this.first = false;
    };
}

function findDraftBreakIndex(
    text: string,
    start: number,
    end: number,
    preference: DraftChunkConfig["breakPreference"]
): number | null {
    const slice = text.slice(start, end);
    if (slice.length === 0) {
        return null;
    }
    const preferredBreak = findPreferredDraftBreak(slice, preference);
    if (preferredBreak !== null) {
        return start + preferredBreak;
    }
    return findWhitespaceDraftBreak(slice, start);
}

function findPreferredDraftBreak(slice: string, preference: DraftChunkConfig["breakPreference"]): number | null {
    if (preference === "paragraph") {
        const idx = slice.lastIndexOf("\n\n");
        if (idx >= 0) {
            return idx + 2;
        }
    }
    if (preference === "paragraph" || preference === "line") {
        const idx = slice.lastIndexOf("\n");
        if (idx >= 0) {
            return idx + 1;
        }
    }
    return null;
}

function findWhitespaceDraftBreak(slice: string, start: number): number | null {
    for (let i = slice.length - 1; i >= 0; i -= 1) {
        if (/\s/.test(slice[i])) {
            return start + i + 1;
        }
    }
    return null;
}

function splitDraftChunks(text: string, config: DraftChunkConfig): string[] {
    const chunks: string[] = [];
    if (!text) {
        return chunks;
    }
    let cursor = 0;
    const length = text.length;
    while (cursor < length) {
        const nextEnd = resolveDraftChunkEnd(text, cursor, length, config);
        chunks.push(text.slice(cursor, nextEnd));
        cursor = nextEnd;
    }
    return chunks;
}

function resolveDraftChunkEnd(
    text: string,
    cursor: number,
    length: number,
    config: DraftChunkConfig
): number {
    const remaining = length - cursor;
    if (remaining <= config.maxChars) {
        return length;
    }
    const minEnd = Math.min(length, cursor + config.minChars);
    const maxEnd = Math.min(length, cursor + config.maxChars);
    const breakIndex = findDraftBreakIndex(text, minEnd, maxEnd, config.breakPreference);
    if (breakIndex !== null && breakIndex > cursor) {
        return breakIndex;
    }
    return maxEnd;
}

function resolveEffectiveDraftChunk(
    draftChunk: DraftChunkConfig,
    streamingMode: DiscordStreamMode
): DraftChunkConfig {
    if (streamingMode === "block") {
        return draftChunk;
    }
    return {
        ...draftChunk,
        minChars: Math.max(1, Math.floor(draftChunk.minChars / 2)),
        maxChars: Math.max(draftChunk.minChars, Math.floor(draftChunk.maxChars / 2))
    };
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
