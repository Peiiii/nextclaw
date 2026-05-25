import { BaseChannel, getDataPath, isTypingStopControlMessage, type Config, type InboundAttachment, type InboundAttachmentErrorCode, type MessageBus, type OutboundMessage, } from "@nextclaw/core";
import { ChannelTypingController, type ExtensionChannelCommands, } from "@nextclaw/extension-sdk";
import { Client, GatewayIntentBits, Partials, MessageFlags, REST, Routes, type Message as DiscordMessage, type Attachment, type ChatInputCommandInteraction, type Interaction, type TextBasedChannel, type TextBasedChannelFields } from "discord.js";
import {
    DISCORD_MAX_LINES_PER_MESSAGE,
    buildAttachmentSummary,
    chunkDiscordText,
    guessMimeFromName,
    resolveDiscordStreamingMode,
    resolveDraftChunkConfig,
    resolveTextChunkLimit,
    sanitizeAttachmentName,
    sendDiscordChunks
} from "../utils/discord-text.utils.js";
import { mapCommandOptions } from "../utils/discord-command.utils.js";
import { sendDiscordDraftStreaming } from "./discord-draft-streaming.service.js";
import { ProxyAgent, fetch } from "undici";
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
const DEFAULT_MEDIA_MAX_MB = 8;
const MEDIA_FETCH_TIMEOUT_MS = 15000;
const TYPING_HEARTBEAT_MS = 6000;
const TYPING_AUTO_STOP_MS = 120000;
const SLASH_GUILD_THRESHOLD = 10;
type AttachmentIssue = {
    id?: string;
    name?: string;
    url?: string;
    code: InboundAttachmentErrorCode;
    message: string;
};
export class DiscordChannel extends BaseChannel<Config["channels"]["discord"]> {
    name = "discord";
    private client: Client | null = null;
    private readonly typingController: ChannelTypingController;
    constructor(config: Config["channels"]["discord"], bus: MessageBus, private readonly commands?: ExtensionChannelCommands) {
        super(config, bus);
        this.typingController = new ChannelTypingController({
            heartbeatMs: TYPING_HEARTBEAT_MS,
            autoStopMs: TYPING_AUTO_STOP_MS,
            sendTyping: async (channelId) => {
                if (!this.client) {
                    return;
                }
                const channel = this.client.channels.cache.get(channelId);
                if (!channel || !channel.isTextBased()) {
                    return;
                }
                const textChannel = channel as TextBasedChannel & TextBasedChannelFields;
                await textChannel.sendTyping();
            }
        });
    }
    start = async (): Promise<void> => {
        if (!this.config.token) {
            throw new Error("Discord token not configured");
        }
        this.running = true;
        this.client = new Client({
            intents: this.config.intents ?? (GatewayIntentBits.Guilds | GatewayIntentBits.GuildMessages | GatewayIntentBits.DirectMessages),
            partials: [Partials.Channel]
        });
        this.client.on("ready", () => {
            // eslint-disable-next-line no-console
            console.log("Discord bot connected");
            void this.registerSlashCommands();
        });
        this.client.on("messageCreate", async (message) => {
            await this.handleIncoming(message);
        });
        this.client.on("interactionCreate", async (interaction) => {
            await this.handleInteraction(interaction);
        });
        await this.client.login(this.config.token);
    };
    stop = async (): Promise<void> => {
        this.running = false;
        this.typingController.stopAll();
        if (this.client) {
            await this.client.destroy();
            this.client = null;
        }
    };
    handleControlMessage = async (msg: OutboundMessage): Promise<boolean> => {
        if (!isTypingStopControlMessage(msg)) {
            return false;
        }
        this.stopTyping(msg.chatId);
        return true;
    };
    send = async (msg: OutboundMessage): Promise<void> => {
        if (isTypingStopControlMessage(msg)) {
            this.stopTyping(msg.chatId);
            return;
        }
        if (!this.client) {
            return;
        }
        const channel = await this.client.channels.fetch(msg.chatId);
        if (!channel || !channel.isTextBased()) {
            return;
        }
        this.stopTyping(msg.chatId);
        const textChannel = channel as TextBasedChannel & TextBasedChannelFields;
        const content = msg.content ?? "";
        const textChunkLimit = resolveTextChunkLimit(this.config);
        const chunks = chunkDiscordText(content, {
            maxChars: textChunkLimit,
            maxLines: DISCORD_MAX_LINES_PER_MESSAGE
        });
        if (chunks.length === 0) {
            return;
        }
        const flags = msg.metadata?.silent === true ? MessageFlags.SuppressNotifications : undefined;
        const streamingMode = resolveDiscordStreamingMode(this.config);
        if (streamingMode === "off") {
            await sendDiscordChunks({
                textChannel,
                chunks,
                replyTo: msg.replyTo ?? undefined,
                flags
            });
            return;
        }
        await sendDiscordDraftStreaming({
            textChannel,
            chunks,
            replyTo: msg.replyTo ?? undefined,
            flags,
            draftChunk: resolveDraftChunkConfig(this.config, textChunkLimit),
            streamingMode
        });
    };
    private handleIncoming = async (message: DiscordMessage): Promise<void> => {
        const context = this.resolveIncomingContext(message);
        if (!context) {
            return;
        }
        const { senderId, channelId, isGroup, mentionState } = context;
        const payload = await this.buildIncomingPayload(message);
        const replyTo = message.reference?.messageId ?? null;
        this.startTyping(channelId);
        try {
            await this.handleMessage({
                senderId,
                chatId: channelId,
                content: payload.content,
                attachments: payload.attachments,
                metadata: {
                    message_id: message.id,
                    channel_id: channelId,
                    guild_id: message.guildId,
                    reply_to: replyTo,
                    account_id: this.resolveAccountId(),
                    accountId: this.resolveAccountId(),
                    is_group: isGroup,
                    peer_kind: isGroup ? "channel" : "direct",
                    peer_id: isGroup ? channelId : senderId,
                    was_mentioned: mentionState.wasMentioned,
                    require_mention: mentionState.requireMention,
                    ...(payload.attachmentIssues.length ? { attachment_issues: payload.attachmentIssues } : {})
                }
            });
        }
        catch (error) {
            this.stopTyping(channelId);
            throw error;
        }
    };
    private resolveIncomingContext = (message: DiscordMessage): {
        senderId: string;
        channelId: string;
        isGroup: boolean;
        mentionState: {
            wasMentioned: boolean;
            requireMention: boolean;
        };
    } | null => {
        const selfUserId = this.client?.user?.id;
        if (selfUserId && message.author.id === selfUserId) {
            return null;
        }
        if (message.author.bot && !this.config.allowBots) {
            return null;
        }
        const senderId = message.author.id;
        const channelId = message.channelId;
        const isGroup = Boolean(message.guildId);
        if (!this.isAllowedByPolicy({ senderId, channelId, isGroup })) {
            return null;
        }
        const mentionState = this.resolveMentionState({ message, selfUserId, channelId, isGroup });
        if (mentionState.requireMention && !mentionState.wasMentioned) {
            return null;
        }
        return { senderId, channelId, isGroup, mentionState };
    };
    private buildIncomingPayload = async (message: DiscordMessage): Promise<{
        content: string;
        attachments: InboundAttachment[];
        attachmentIssues: AttachmentIssue[];
    }> => {
        const contentParts = message.content ? [message.content] : [];
        const { attachments, attachmentIssues } = await this.resolveIncomingAttachments(message);
        if (!message.content && attachments.length > 0) {
            contentParts.push(buildAttachmentSummary(attachments));
        }
        return {
            content: contentParts.length ? contentParts.join("\n") : "[empty message]",
            attachments,
            attachmentIssues
        };
    };
    private resolveIncomingAttachments = async (message: DiscordMessage): Promise<{
        attachments: InboundAttachment[];
        attachmentIssues: AttachmentIssue[];
    }> => {
        const attachments: InboundAttachment[] = [];
        const attachmentIssues: AttachmentIssue[] = [];
        if (!message.attachments.size) {
            return { attachments, attachmentIssues };
        }
        const mediaDir = join(getDataPath(), "media");
        mkdirSync(mediaDir, { recursive: true });
        const maxBytes = Math.max(1, this.config.mediaMaxMb ?? DEFAULT_MEDIA_MAX_MB) * 1024 * 1024;
        const proxy = this.resolveProxyAgent();
        for (const attachment of message.attachments.values()) {
            const resolved = await this.resolveInboundAttachment({ attachment, mediaDir, maxBytes, proxy });
            if (resolved.attachment) {
                attachments.push(resolved.attachment);
            }
            if (resolved.issue) {
                attachmentIssues.push(resolved.issue);
            }
        }
        return { attachments, attachmentIssues };
    };
    private handleInteraction = async (interaction: Interaction): Promise<void> => {
        if (!interaction.isChatInputCommand()) {
            return;
        }
        await this.handleSlashCommand(interaction);
    };
    private handleSlashCommand = async (interaction: ChatInputCommandInteraction): Promise<void> => {
        if (!this.commands) {
            await this.replyInteraction(interaction, "Slash commands are not available.", true);
            return;
        }
        const channelId = interaction.channelId;
        if (!channelId) {
            await this.replyInteraction(interaction, "Slash commands are not available in this channel.", true);
            return;
        }
        const senderId = interaction.user.id;
        const isGroup = Boolean(interaction.guildId);
        if (!this.isAllowedByPolicy({ senderId, channelId, isGroup })) {
            await this.replyInteraction(interaction, "You are not authorized to use commands here.", true);
            return;
        }
        const args: Record<string, unknown> = {};
        for (const option of interaction.options.data) {
            if (typeof option.name === "string" && option.value !== undefined) {
                args[option.name] = option.value;
            }
        }
        try {
            await interaction.deferReply({ ephemeral: true });
            const result = await this.commands.execute({
                commandName: interaction.commandName,
                args,
                conversationId: channelId,
                senderId,
                metadata: {
                    message_id: interaction.id,
                    channel_id: channelId,
                    guild_id: interaction.guildId,
                    account_id: this.resolveAccountId(),
                    accountId: this.resolveAccountId(),
                    is_group: isGroup,
                    peer_kind: isGroup ? "channel" : "direct",
                    peer_id: isGroup ? channelId : senderId,
                },
            });
            if (result.ephemeral === false) {
                await interaction.editReply({ content: "Command executed." });
                await interaction.followUp({ content: result.content, ephemeral: false });
                return;
            }
            await interaction.editReply({ content: result.content });
        }
        catch (error) {
            await this.replyInteraction(interaction, "Command failed to execute.", true);
            // eslint-disable-next-line no-console
            console.error(`Discord slash command error: ${String(error)}`);
        }
    };
    private replyInteraction = async (interaction: ChatInputCommandInteraction, content: string, ephemeral: boolean): Promise<void> => {
        const payload = { content, ephemeral };
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(payload);
            return;
        }
        await interaction.reply(payload);
    };
    private registerSlashCommands = async (): Promise<void> => {
        if (!this.client || !this.commands) {
            return;
        }
        const appId = this.client.application?.id ?? this.client.user?.id;
        if (!appId) {
            return;
        }
        const commands = await this.buildSlashCommandPayloads();
        if (!commands.length) {
            return;
        }
        const rest = new REST({ version: "10" }).setToken(this.config.token);
        let guildIds: string[] = [];
        try {
            const guilds = await this.client.guilds.fetch();
            guildIds = [...guilds.keys()];
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Failed to fetch Discord guild list: ${String(error)}`);
        }
        try {
            if (guildIds.length > 0 && guildIds.length <= SLASH_GUILD_THRESHOLD) {
                for (const guildId of guildIds) {
                    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body: commands });
                }
                // eslint-disable-next-line no-console
                console.log(`Discord slash commands registered for ${guildIds.length} guild(s).`);
            }
            else {
                await rest.put(Routes.applicationCommands(appId), { body: commands });
                // eslint-disable-next-line no-console
                console.log("Discord slash commands registered globally.");
            }
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Failed to register Discord slash commands: ${String(error)}`);
        }
    };
    private buildSlashCommandPayloads = async (): Promise<Array<Record<string, unknown>>> => {
        const specs = await this.commands?.list() ?? [];
        return specs.map((spec) => ({
            name: spec.name,
            description: spec.description,
            options: mapCommandOptions(spec.options)
        }));
    };
    private resolveProxyAgent = (): ProxyAgent | null => {
        const proxy = this.config.proxy?.trim();
        if (!proxy) {
            return null;
        }
        try {
            return new ProxyAgent(proxy);
        }
        catch {
            return null;
        }
    };
    private resolveAccountId = (): string => {
        const accountId = this.config.accountId?.trim();
        return accountId || "default";
    };
    private isAllowedByPolicy = (params: {
        senderId: string;
        channelId: string;
        isGroup: boolean;
    }): boolean => {
        const { senderId, channelId, isGroup } = params;
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
            return allowFrom.includes("*") || allowFrom.includes(channelId);
        }
        return true;
    };
    private resolveMentionState = (params: {
        message: DiscordMessage;
        selfUserId?: string;
        channelId: string;
        isGroup: boolean;
    }): {
        wasMentioned: boolean;
        requireMention: boolean;
    } => {
        const { message, selfUserId, channelId, isGroup } = params;
        if (!isGroup) {
            return { wasMentioned: false, requireMention: false };
        }
        const groups = this.config.groups ?? {};
        const groupRule = groups[channelId] ?? groups["*"];
        const requireMention = groupRule?.requireMention ?? this.config.requireMention ?? false;
        if (!requireMention) {
            return { wasMentioned: false, requireMention: false };
        }
        const patterns = [
            ...(this.config.mentionPatterns ?? []),
            ...(groupRule?.mentionPatterns ?? [])
        ]
            .map((pattern) => pattern.trim())
            .filter(Boolean);
        const content = message.content ?? "";
        const wasMentionedByUserRef = Boolean(selfUserId) && message.mentions.users.has(selfUserId ?? "");
        const wasMentionedByText = Boolean(selfUserId) &&
            (content.includes(`<@${selfUserId}>`) || content.includes(`<@!${selfUserId}>`));
        const wasMentionedByPattern = patterns.some((pattern) => {
            try {
                return new RegExp(pattern, "i").test(content);
            }
            catch {
                return content.toLowerCase().includes(pattern.toLowerCase());
            }
        });
        return {
            wasMentioned: wasMentionedByUserRef || wasMentionedByText || wasMentionedByPattern,
            requireMention
        };
    };
    private resolveInboundAttachment = async (params: {
        attachment: Attachment;
        mediaDir: string;
        maxBytes: number;
        proxy: ProxyAgent | null;
    }): Promise<{
        attachment?: InboundAttachment;
        issue?: AttachmentIssue;
    }> => {
        const { attachment, mediaDir, maxBytes, proxy } = params;
        const id = attachment.id;
        const name = attachment.name ?? "file";
        const url = attachment.url;
        const mimeType = attachment.contentType ?? guessMimeFromName(name) ?? undefined;
        if (!url) {
            return {
                issue: {
                    id,
                    name,
                    code: "invalid_payload",
                    message: "attachment URL missing"
                }
            };
        }
        if (attachment.size && attachment.size > maxBytes) {
            return {
                attachment: {
                    id,
                    name,
                    url,
                    mimeType,
                    size: attachment.size,
                    source: "discord",
                    status: "remote-only",
                    errorCode: "too_large"
                },
                issue: {
                    id,
                    name,
                    url,
                    code: "too_large",
                    message: `attachment size ${attachment.size} exceeds ${maxBytes}`
                }
            };
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), MEDIA_FETCH_TIMEOUT_MS);
        try {
            const fetchInit: Parameters<typeof fetch>[1] = {
                signal: controller.signal,
                dispatcher: proxy ?? undefined
            };
            const res = await fetch(url, fetchInit);
            if (!res.ok) {
                return {
                    attachment: {
                        id,
                        name,
                        url,
                        mimeType,
                        size: attachment.size,
                        source: "discord",
                        status: "remote-only",
                        errorCode: "http_error"
                    },
                    issue: {
                        id,
                        name,
                        url,
                        code: "http_error",
                        message: `HTTP ${res.status}`
                    }
                };
            }
            const buffer = Buffer.from(await res.arrayBuffer());
            if (buffer.length > maxBytes) {
                return {
                    attachment: {
                        id,
                        name,
                        url,
                        mimeType,
                        size: buffer.length,
                        source: "discord",
                        status: "remote-only",
                        errorCode: "too_large"
                    },
                    issue: {
                        id,
                        name,
                        url,
                        code: "too_large",
                        message: `downloaded payload ${buffer.length} exceeds ${maxBytes}`
                    }
                };
            }
            const filename = `${id}_${sanitizeAttachmentName(name)}`;
            const filePath = join(mediaDir, filename);
            writeFileSync(filePath, buffer);
            return {
                attachment: {
                    id,
                    name,
                    path: filePath,
                    url,
                    mimeType,
                    size: buffer.length,
                    source: "discord",
                    status: "ready"
                }
            };
        }
        catch (err) {
            return {
                attachment: {
                    id,
                    name,
                    url,
                    mimeType,
                    size: attachment.size,
                    source: "discord",
                    status: "remote-only",
                    errorCode: "download_failed"
                },
                issue: {
                    id,
                    name,
                    url,
                    code: "download_failed",
                    message: String(err)
                }
            };
        }
        finally {
            clearTimeout(timeoutId);
        }
    };
    private startTyping = (channelId: string): void => {
        this.typingController.start(channelId);
    };
    private stopTyping = (channelId: string): void => {
        this.typingController.stop(channelId);
    };
}
