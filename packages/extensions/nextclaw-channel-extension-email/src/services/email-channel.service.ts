import { APP_REPLY_SUBJECT, BaseChannel, type Config, type MessageBus, type OutboundMessage } from "@nextclaw/core";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export class EmailChannel extends BaseChannel<Config["channels"]["email"]> {
    name = "email";
    private lastSubjectByChat: Map<string, string> = new Map();
    private lastMessageIdByChat: Map<string, string> = new Map();
    private processedUids: Set<string> = new Set();
    private maxProcessedUids = 100000;
    constructor(config: Config["channels"]["email"], bus: MessageBus) {
        super(config, bus);
    }
    start = async (): Promise<void> => {
        if (!this.config.consentGranted) {
            return;
        }
        if (!this.validateConfig()) {
            return;
        }
        this.running = true;
        const pollSeconds = Math.max(5, Number(this.config.pollIntervalSeconds ?? 30));
        while (this.running) {
            try {
                const items = await this.fetchNewMessages();
                for (const item of items) {
                    if (item.subject) {
                        this.lastSubjectByChat.set(item.sender, item.subject);
                    }
                    if (item.messageId) {
                        this.lastMessageIdByChat.set(item.sender, item.messageId);
                    }
                    await this.handleMessage({
                        senderId: item.sender,
                        chatId: item.sender,
                        content: item.content,
                        attachments: [],
                        metadata: item.metadata ?? {}
                    });
                }
            }
            catch {
                // swallow errors in polling loop
            }
            await sleep(pollSeconds * 1000);
        }
    };
    stop = async (): Promise<void> => {
        this.running = false;
    };
    send = async (msg: OutboundMessage): Promise<void> => {
        if (!this.config.consentGranted) {
            return;
        }
        const forceSend = Boolean((msg.metadata ?? {}).force_send);
        if (!this.config.autoReplyEnabled && !forceSend) {
            return;
        }
        if (!this.config.smtpHost) {
            return;
        }
        const toAddr = msg.chatId.trim();
        if (!toAddr) {
            return;
        }
        const baseSubject = this.lastSubjectByChat.get(toAddr) ?? APP_REPLY_SUBJECT;
        const subject = (msg.metadata?.subject as string | undefined)?.trim() || this.replySubject(baseSubject);
        const transporter = nodemailer.createTransport({
            host: this.config.smtpHost,
            port: this.config.smtpPort,
            secure: this.config.smtpUseSsl,
            auth: {
                user: this.config.smtpUsername,
                pass: this.config.smtpPassword
            },
            tls: this.config.smtpUseTls ? { rejectUnauthorized: false } : undefined
        });
        await transporter.sendMail({
            from: this.config.fromAddress || this.config.smtpUsername || this.config.imapUsername,
            to: toAddr,
            subject,
            text: msg.content ?? "",
            inReplyTo: this.lastMessageIdByChat.get(toAddr) ?? undefined,
            references: this.lastMessageIdByChat.get(toAddr) ?? undefined
        });
    };
    private validateConfig = (): boolean => {
        const missing: string[] = [];
        if (!this.config.imapHost)
            missing.push("imapHost");
        if (!this.config.imapUsername)
            missing.push("imapUsername");
        if (!this.config.imapPassword)
            missing.push("imapPassword");
        if (!this.config.smtpHost)
            missing.push("smtpHost");
        if (!this.config.smtpUsername)
            missing.push("smtpUsername");
        if (!this.config.smtpPassword)
            missing.push("smtpPassword");
        return missing.length === 0;
    };
    private replySubject = (subject: string): string => {
        const prefix = this.config.subjectPrefix || "Re: ";
        return subject.startsWith(prefix) ? subject : `${prefix}${subject}`;
    };
    private fetchNewMessages = async (): Promise<Array<{
        sender: string;
        subject: string;
        content: string;
        messageId: string;
        metadata: Record<string, unknown>;
    }>> => {
        const client = new ImapFlow({
            host: this.config.imapHost,
            port: this.config.imapPort,
            secure: this.config.imapUseSsl,
            auth: {
                user: this.config.imapUsername,
                pass: this.config.imapPassword
            }
        });
        await client.connect();
        const lock = await client.getMailboxLock(this.config.imapMailbox || "INBOX");
        const items: Array<{
            sender: string;
            subject: string;
            content: string;
            messageId: string;
            metadata: Record<string, unknown>;
        }> = [];
        try {
            const uids = await client.search({ seen: false });
            if (!Array.isArray(uids)) {
                return items;
            }
            for (const uid of uids) {
                const item = await this.fetchMessageItem(client, uid);
                if (item) {
                    items.push(item);
                }
            }
        }
        finally {
            lock.release();
            await client.logout();
        }
        return items;
    };
    private fetchMessageItem = async (client: ImapFlow, uid: number | string): Promise<{
        sender: string;
        subject: string;
        content: string;
        messageId: string;
        metadata: Record<string, unknown>;
    } | null> => {
        const key = String(uid);
        if (this.processedUids.has(key)) {
            return null;
        }
        const message = await client.fetchOne(uid, { uid: true, source: true, envelope: true });
        if (!message || !message.source) {
            return null;
        }
        const parsed = await simpleParser(message.source);
        const sender = parsed.from?.value?.[0]?.address ?? "";
        if (!sender || !this.isAllowed(sender)) {
            return null;
        }
        if (this.config.markSeen) {
            await client.messageFlagsAdd(uid, ["\\Seen"]);
        }
        this.rememberProcessedUid(key);
        return {
            sender,
            subject: parsed.subject ?? "",
            content: normalizeEmailBody(parsed.text ?? parsed.html ?? "").slice(0, this.config.maxBodyChars),
            messageId: parsed.messageId ?? "",
            metadata: { subject: parsed.subject ?? "" }
        };
    };
    private rememberProcessedUid = (key: string): void => {
        this.processedUids.add(key);
        if (this.processedUids.size <= this.maxProcessedUids) {
            return;
        }
        const iterator = this.processedUids.values();
        const oldest = iterator.next().value as string | undefined;
        if (oldest) {
            this.processedUids.delete(oldest);
        }
    };
}

function normalizeEmailBody(rawContent: string | false): string {
    return typeof rawContent === "string" ? rawContent : "";
}
