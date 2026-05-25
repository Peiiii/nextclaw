import { BaseChannel, type Config, type MessageBus, type OutboundMessage } from "@nextclaw/core";
import { WebClient } from "@slack/web-api";
import { SocketModeClient } from "@slack/socket-mode";
export class SlackChannel extends BaseChannel<Config["channels"]["slack"]> {
    name = "slack";
    private webClient: WebClient | null = null;
    private socketClient: SocketModeClient | null = null;
    private botUserId: string | null = null;
    private botId: string | null = null;
    constructor(config: Config["channels"]["slack"], bus: MessageBus) {
        super(config, bus);
    }
    start = async (): Promise<void> => {
        if (!this.config.botToken || !this.config.appToken) {
            throw new Error("Slack bot/app token not configured");
        }
        if (this.config.mode !== "socket") {
            throw new Error(`Unsupported Slack mode: ${this.config.mode}`);
        }
        this.running = true;
        this.webClient = new WebClient(this.config.botToken);
        this.socketClient = new SocketModeClient({
            appToken: this.config.appToken
        });
        this.socketClient.on("events_api", async ({ body, ack }) => {
            await ack();
            await this.handleEvent(body?.event);
        });
        try {
            const auth = await this.webClient.auth.test();
            this.botUserId = auth.user_id ?? null;
            this.botId = (auth as {
                bot_id?: string;
            }).bot_id ?? null;
        }
        catch {
            this.botUserId = null;
            this.botId = null;
        }
        await this.socketClient.start();
    };
    stop = async (): Promise<void> => {
        this.running = false;
        if (this.socketClient) {
            await this.socketClient.disconnect();
            this.socketClient = null;
        }
        this.botUserId = null;
        this.botId = null;
    };
    send = async (msg: OutboundMessage): Promise<void> => {
        if (!this.webClient) {
            return;
        }
        const slackMeta = (msg.metadata?.slack as Record<string, unknown>) ?? {};
        const threadTs = slackMeta.thread_ts as string | undefined;
        const channelType = slackMeta.channel_type as string | undefined;
        const useThread = Boolean(threadTs && channelType !== "im");
        await this.webClient.chat.postMessage({
            channel: msg.chatId,
            text: msg.content ?? "",
            thread_ts: useThread ? threadTs : undefined
        });
    };
    private handleEvent = async (event: Record<string, unknown> | undefined): Promise<void> => {
        const context = this.resolveEventContext(event);
        if (!context) {
            return;
        }
        const { senderId, chatId, channelType, text, eventTs } = context;
        if (!this.shouldDispatchEvent(context)) {
            return;
        }
        const cleanText = this.stripBotMention(text);
        const threadTs = (event?.thread_ts as string | undefined) ?? eventTs;
        await this.addAckReaction(chatId, eventTs);
        await this.handleMessage({
            senderId,
            chatId,
            content: cleanText,
            attachments: [],
            metadata: {
                slack: {
                    event,
                    thread_ts: threadTs,
                    channel_type: channelType
                }
            }
        });
    };
    private resolveEventContext = (event: Record<string, unknown> | undefined): {
        event: Record<string, unknown>;
        eventType: string;
        subtype?: string;
        botId?: string;
        isBotMessage: boolean;
        senderId: string;
        chatId: string;
        channelType: string;
        text: string;
        eventTs?: string;
    } | null => {
        if (!event) {
            return null;
        }
        const eventType = event.type as string | undefined;
        if (eventType !== "message" && eventType !== "app_mention") {
            return null;
        }
        const subtype = event.subtype as string | undefined;
        const botId = event.bot_id as string | undefined;
        const isBotMessage = subtype === "bot_message" || Boolean(botId);
        if (subtype && subtype !== "bot_message") {
            return null;
        }
        if (isBotMessage && !this.config.allowBots) {
            return null;
        }
        const senderId = (event.user as string | undefined) ?? (isBotMessage ? botId : undefined);
        const chatId = event.channel as string | undefined;
        const channelType = (event.channel_type as string | undefined) ?? "";
        const text = (event.text as string | undefined) ?? "";
        if (!senderId || !chatId) {
            return null;
        }
        return { event, eventType, subtype, botId, isBotMessage, senderId, chatId, channelType, text, eventTs: event.ts as string | undefined };
    };
    private shouldDispatchEvent = (context: {
        event: Record<string, unknown>;
        eventType: string;
        botId?: string;
        isBotMessage: boolean;
        senderId: string;
        chatId: string;
        channelType: string;
        text: string;
    }): boolean => {
        const { event, eventType, botId, isBotMessage, senderId, chatId, channelType, text } = context;
        if (this.botUserId && event.user === this.botUserId) {
            return false;
        }
        if (this.botId && botId && botId === this.botId) {
            return false;
        }
        if (eventType === "message" && !isBotMessage && this.botUserId && text.includes(`<@${this.botUserId}>`)) {
            return false;
        }
        if (!this.isAllowedInSlack(senderId, chatId, channelType)) {
            return false;
        }
        if (channelType !== "im" && !this.shouldRespondInChannel(eventType, text, chatId)) {
            return false;
        }
        return true;
    };
    private addAckReaction = async (chatId: string, eventTs?: string): Promise<void> => {
        if (!this.webClient || !eventTs) {
            return;
        }
        try {
            await this.webClient.reactions.add({
                channel: chatId,
                name: "eyes",
                timestamp: eventTs
            });
        }
        catch {
            // ignore reaction errors
        }
    };
    private isAllowedInSlack = (senderId: string, chatId: string, channelType: string): boolean => {
        if (channelType === "im") {
            if (!this.config.dm.enabled) {
                return false;
            }
            if (this.config.dm.policy === "allowlist") {
                return this.config.dm.allowFrom.includes(senderId);
            }
            return true;
        }
        if (this.config.groupPolicy === "allowlist") {
            return this.config.groupAllowFrom.includes(chatId);
        }
        return true;
    };
    private shouldRespondInChannel = (eventType: string, text: string, chatId: string): boolean => {
        if (this.config.groupPolicy === "open") {
            return true;
        }
        if (this.config.groupPolicy === "mention") {
            if (eventType === "app_mention") {
                return true;
            }
            return this.botUserId ? text.includes(`<@${this.botUserId}>`) : false;
        }
        if (this.config.groupPolicy === "allowlist") {
            return this.config.groupAllowFrom.includes(chatId);
        }
        return false;
    };
    private stripBotMention = (text: string): string => {
        if (!text || !this.botUserId) {
            return text;
        }
        const pattern = new RegExp(`<@${this.botUserId}>\\s*`, "g");
        return text.replace(pattern, "").trim();
    };
}
