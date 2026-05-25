import { createHash } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { BaseChannel, type Config, type MessageBus, type OutboundMessage } from "@nextclaw/core";
import { fetch } from "undici";
const MSG_TYPE_FALLBACK: Record<string, string> = {
    image: "[image]",
    voice: "[voice]",
    video: "[video]",
    file: "[file]",
    location: "[location]",
    event: "[event]"
};
const TOKEN_EXPIRY_BUFFER_MS = 60000;
export class WeComChannel extends BaseChannel<Config["channels"]["wecom"]> {
    name = "wecom";
    private server: Server | null = null;
    private accessToken: string | null = null;
    private tokenExpiry = 0;
    private processedIds: string[] = [];
    private processedSet: Set<string> = new Set();
    constructor(config: Config["channels"]["wecom"], bus: MessageBus) {
        super(config, bus);
    }
    start = async (): Promise<void> => {
        if (!this.config.corpId || !this.config.agentId || !this.config.secret || !this.config.token) {
            throw new Error("WeCom corpId/agentId/secret/token not configured");
        }
        this.running = true;
        await new Promise<void>((resolve, reject) => {
            this.server = createServer((req, res) => {
                void this.handleCallbackRequest(req, res);
            });
            this.server.once("error", reject);
            this.server.listen(this.config.callbackPort, () => {
                this.server?.off("error", reject);
                resolve();
            });
        });
    };
    stop = async (): Promise<void> => {
        this.running = false;
        if (!this.server) {
            return;
        }
        await new Promise<void>((resolve) => {
            this.server?.close(() => resolve());
        });
        this.server = null;
    };
    send = async (msg: OutboundMessage): Promise<void> => {
        const receiver = msg.chatId?.trim();
        if (!receiver) {
            return;
        }
        const content = normalizeOutboundContent(msg);
        if (!content) {
            return;
        }
        const accessToken = await this.getAccessToken();
        const sendUrl = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(accessToken)}`;
        const agentIdNumber = Number(this.config.agentId);
        const payload = {
            touser: receiver,
            msgtype: "text",
            agentid: Number.isFinite(agentIdNumber) ? agentIdNumber : this.config.agentId,
            text: {
                content
            },
            safe: 0
        };
        const response = await fetch(sendUrl, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`WeCom send failed: HTTP ${response.status}`);
        }
        const body = (await response.json()) as Record<string, unknown>;
        const errcode = Number(body.errcode ?? -1);
        if (!Number.isFinite(errcode) || errcode !== 0) {
            const errmsg = typeof body.errmsg === "string" ? body.errmsg : "unknown error";
            throw new Error(`WeCom send failed: ${errcode} ${errmsg}`);
        }
    };
    private handleCallbackRequest = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        const callbackPath = normalizeCallbackPath(this.config.callbackPath);
        const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
        if (requestUrl.pathname !== callbackPath) {
            res.statusCode = 404;
            res.end("not found");
            return;
        }
        const method = (req.method ?? "GET").toUpperCase();
        if (method === "GET") {
            this.handleVerificationRequest(requestUrl, res);
            return;
        }
        if (method === "POST") {
            await this.handleInboundMessageRequest(req, requestUrl, res);
            return;
        }
        res.statusCode = 405;
        res.end("method not allowed");
    };
    private handleVerificationRequest = (requestUrl: URL, res: ServerResponse): void => {
        const timestamp = requestUrl.searchParams.get("timestamp") ?? "";
        const nonce = requestUrl.searchParams.get("nonce") ?? "";
        const echostr = requestUrl.searchParams.get("echostr") ?? "";
        const signature = requestUrl.searchParams.get("msg_signature") ?? requestUrl.searchParams.get("signature") ?? "";
        if (!timestamp || !nonce || !echostr || !signature) {
            res.statusCode = 400;
            res.end("invalid verification payload");
            return;
        }
        if (!this.verifySignature(timestamp, nonce, signature)) {
            res.statusCode = 401;
            res.end("signature mismatch");
            return;
        }
        res.statusCode = 200;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end(echostr);
    };
    private handleInboundMessageRequest = async (req: IncomingMessage, requestUrl: URL, res: ServerResponse): Promise<void> => {
        const timestamp = requestUrl.searchParams.get("timestamp") ?? "";
        const nonce = requestUrl.searchParams.get("nonce") ?? "";
        const signature = requestUrl.searchParams.get("msg_signature") ?? requestUrl.searchParams.get("signature") ?? "";
        if (!timestamp || !nonce || !signature || !this.verifySignature(timestamp, nonce, signature)) {
            res.statusCode = 401;
            res.end("signature mismatch");
            return;
        }
        const rawBody = await readBody(req);
        if (!rawBody.trim()) {
            this.respondSuccess(res);
            return;
        }
        if (extractXmlField(rawBody, "Encrypt")) {
            this.respondSuccess(res);
            return;
        }
        const senderId = extractXmlField(rawBody, "FromUserName");
        if (!senderId || !this.isAllowed(senderId)) {
            this.respondSuccess(res);
            return;
        }
        const msgType = extractXmlField(rawBody, "MsgType") || "text";
        const msgId = extractXmlField(rawBody, "MsgId") || buildSyntheticMessageId(rawBody, senderId, msgType);
        if (this.isDuplicate(msgId)) {
            this.respondSuccess(res);
            return;
        }
        const content = extractXmlField(rawBody, "Content")?.trim() || MSG_TYPE_FALLBACK[msgType.toLowerCase()] || "[unsupported message]";
        await this.handleMessage({
            senderId,
            chatId: senderId,
            content,
            attachments: [],
            metadata: {
                message_id: msgId,
                wecom: {
                    msgType,
                    toUserName: extractXmlField(rawBody, "ToUserName"),
                    agentId: extractXmlField(rawBody, "AgentID"),
                    createTime: extractXmlField(rawBody, "CreateTime")
                }
            }
        });
        this.respondSuccess(res);
    };
    private respondSuccess = (res: ServerResponse): void => {
        res.statusCode = 200;
        res.setHeader("content-type", "text/plain; charset=utf-8");
        res.end("success");
    };
    private verifySignature = (timestamp: string, nonce: string, signature: string): boolean => {
        const expected = createHash("sha1")
            .update([this.config.token, timestamp, nonce].sort().join(""))
            .digest("hex");
        return expected === signature;
    };
    private getAccessToken = async (): Promise<string> => {
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }
        const tokenUrl = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(this.config.corpId)}` +
            `&corpsecret=${encodeURIComponent(this.config.secret)}`;
        const response = await fetch(tokenUrl, { method: "GET" });
        if (!response.ok) {
            throw new Error(`WeCom gettoken failed: HTTP ${response.status}`);
        }
        const body = (await response.json()) as Record<string, unknown>;
        const errcode = Number(body.errcode ?? -1);
        if (!Number.isFinite(errcode) || errcode !== 0) {
            const errmsg = typeof body.errmsg === "string" ? body.errmsg : "unknown error";
            throw new Error(`WeCom gettoken failed: ${errcode} ${errmsg}`);
        }
        const accessToken = typeof body.access_token === "string" ? body.access_token : "";
        const expiresIn = Number(body.expires_in ?? 7200);
        if (!accessToken) {
            throw new Error("WeCom gettoken failed: missing access_token");
        }
        this.accessToken = accessToken;
        this.tokenExpiry = Date.now() + Math.max(0, expiresIn * 1000 - TOKEN_EXPIRY_BUFFER_MS);
        return accessToken;
    };
    private isDuplicate = (messageId: string): boolean => {
        if (this.processedSet.has(messageId)) {
            return true;
        }
        this.processedSet.add(messageId);
        this.processedIds.push(messageId);
        if (this.processedIds.length > 1000) {
            const removed = this.processedIds.splice(0, 500);
            for (const id of removed) {
                this.processedSet.delete(id);
            }
        }
        return false;
    };
}
function normalizeCallbackPath(path: string): string {
    if (!path) {
        return "/wecom/callback";
    }
    return path.startsWith("/") ? path : `/${path}`;
}
function buildSyntheticMessageId(rawBody: string, senderId: string, msgType: string): string {
    return createHash("sha1").update(`${senderId}:${msgType}:${rawBody}`).digest("hex");
}
function extractXmlField(xml: string, field: string): string {
    const cdataPattern = new RegExp(`<${field}><!\\[CDATA\\[(.*?)\\]\\]><\\/${field}>`, "s");
    const cdataMatch = xml.match(cdataPattern);
    if (cdataMatch?.[1]) {
        return cdataMatch[1].trim();
    }
    const textPattern = new RegExp(`<${field}>(.*?)<\\/${field}>`, "s");
    const textMatch = xml.match(textPattern);
    return textMatch?.[1]?.trim() ?? "";
}
async function readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    return await new Promise<string>((resolve, reject) => {
        req.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        req.on("error", reject);
        req.on("end", () => {
            resolve(Buffer.concat(chunks).toString("utf8"));
        });
    });
}
function normalizeOutboundContent(msg: OutboundMessage): string {
    const segments: string[] = [];
    if (typeof msg.content === "string" && msg.content.trim()) {
        segments.push(msg.content.trim());
    }
    if (Array.isArray(msg.media)) {
        for (const item of msg.media) {
            if (typeof item === "string" && item.trim()) {
                segments.push(item.trim());
            }
        }
    }
    return segments.join("\n").trim();
}
