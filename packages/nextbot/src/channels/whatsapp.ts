import { BaseChannel } from "./base.js";
import type { MessageBus } from "../bus/queue.js";
import type { OutboundMessage } from "../bus/events.js";
import type { Config } from "../config/schema.js";
import WebSocket from "ws";

export class WhatsAppChannel extends BaseChannel<Config["channels"]["whatsapp"]> {
  name = "whatsapp";
  private ws: WebSocket | null = null;
  private connected = false;

  constructor(config: Config["channels"]["whatsapp"], bus: MessageBus) {
    super(config, bus);
  }

  async start(): Promise<void> {
    this.running = true;
    const bridgeUrl = this.config.bridgeUrl;

    while (this.running) {
      try {
        await new Promise<void>((resolve, reject) => {
          const ws = new WebSocket(bridgeUrl);
          this.ws = ws;

          ws.on("open", () => {
            this.connected = true;
          });

          ws.on("message", (data: WebSocket.RawData) => {
            const payload = data.toString();
            void this.handleBridgeMessage(payload);
          });

          ws.on("close", () => {
            this.connected = false;
            this.ws = null;
            resolve();
          });

          ws.on("error", (_err: Error) => {
            this.connected = false;
            this.ws = null;
            reject(_err);
          });
        });
      } catch {
        if (!this.running) {
          break;
        }
        await sleep(5000);
      }
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    this.connected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async send(msg: OutboundMessage): Promise<void> {
    if (!this.ws || !this.connected) {
      return;
    }
    const payload = {
      type: "send",
      to: msg.chatId,
      text: msg.content
    };
    this.ws.send(JSON.stringify(payload));
  }

  private async handleBridgeMessage(raw: string): Promise<void> {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const msgType = data.type as string | undefined;

    if (msgType === "message") {
      const pn = (data.pn as string | undefined) ?? "";
      const sender = (data.sender as string | undefined) ?? "";
      let content = (data.content as string | undefined) ?? "";

      const userId = pn || sender;
      const senderId = userId.includes("@") ? userId.split("@")[0] : userId;

      if (content === "[Voice Message]") {
        content = "[Voice Message: Transcription not available for WhatsApp yet]";
      }

      await this.handleMessage({
        senderId,
        chatId: sender || userId,
        content,
        media: [],
        metadata: {
          message_id: data.id,
          timestamp: data.timestamp,
          is_group: Boolean(data.isGroup)
        }
      });
      return;
    }

    if (msgType === "status") {
      const status = data.status as string | undefined;
      if (status === "connected") {
        this.connected = true;
      } else if (status === "disconnected") {
        this.connected = false;
      }
      return;
    }

    if (msgType === "qr") {
      return;
    }

    if (msgType === "error") {
      return;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
