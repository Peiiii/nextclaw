import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import { DWClient, EventAck, TOPIC_ROBOT, type DWClientDownStream } from "dingtalk-stream";
import { fetch } from "undici";

export class DingTalkChannel extends BaseChannel<Config["channels"]["dingtalk"]> {
  name = "dingtalk";
  private client: DWClient | null = null;
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(config: Config["channels"]["dingtalk"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error("DingTalk clientId/clientSecret not configured");
    }

    this.client = new DWClient({
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      debug: false
    });

    this.client.registerCallbackListener(TOPIC_ROBOT, async (res: DWClientDownStream) => {
      await this.handleRobotMessage(res);
    });

    this.client.registerAllEventListener(() => ({ status: EventAck.SUCCESS }));

    await this.client.connect();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }

  async send(msg: OutboundMessage): Promise<void> {
    const token = await this.getAccessToken();
    if (!token) {
      return;
    }

    const url = "https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend";
    const payload = {
      robotCode: this.config.clientId,
      userIds: [msg.chatId],
      msgKey: "sampleMarkdown",
      msgParam: JSON.stringify({
        text: msg.content,
        title: "Nanobot Reply"
      })
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-acs-dingtalk-access-token": token
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`DingTalk send failed: ${response.status}`);
    }
  }

  private async handleRobotMessage(res: DWClientDownStream): Promise<void> {
    if (!res?.data) {
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(res.data) as Record<string, unknown>;
    } catch {
      return;
    }

    const text = (parsed.text as { content?: string } | undefined)?.content?.trim() ?? "";
    if (!text) {
      this.client?.socketCallBackResponse(res.headers.messageId, { ok: true });
      return;
    }

    const senderId = (parsed.senderStaffId as string | undefined) || (parsed.senderId as string | undefined) || "";
    const senderName = (parsed.senderNick as string | undefined) || "";

    if (!senderId) {
      this.client?.socketCallBackResponse(res.headers.messageId, { ok: true });
      return;
    }

    await this.handleMessage({
      senderId,
      chatId: senderId,
      content: text,
      media: [],
      metadata: {
        sender_name: senderName,
        platform: "dingtalk"
      }
    });

    this.client?.socketCallBackResponse(res.headers.messageId, { ok: true });
  }

  private async getAccessToken(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const url = "https://api.dingtalk.com/v1.0/oauth2/accessToken";
    const payload = {
      appKey: this.config.clientId,
      appSecret: this.config.clientSecret
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    const token = data.accessToken as string | undefined;
    const expiresIn = Number(data.expireIn ?? 7200);
    if (!token) {
      return null;
    }

    this.accessToken = token;
    this.tokenExpiry = Date.now() + (expiresIn - 60) * 1000;
    return token;
  }
}
