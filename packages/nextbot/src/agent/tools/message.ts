import type { OutboundMessage } from "../../bus/events.js";
import { Tool } from "./base.js";

export class MessageTool extends Tool {
  private channel = "cli";
  private chatId = "direct";

  constructor(private sendCallback: (msg: OutboundMessage) => Promise<void>) {
    super();
  }

  get name(): string {
    return "message";
  }

  get description(): string {
    return "Send a message to a chat channel";
  }

  get parameters(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        content: { type: "string", description: "Message to send" },
        channel: { type: "string", description: "Channel name" },
        chatId: { type: "string", description: "Chat ID" }
      },
      required: ["content"]
    };
  }

  setContext(channel: string, chatId: string): void {
    this.channel = channel;
    this.chatId = chatId;
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const content = String(params.content ?? "");
    const channel = String(params.channel ?? this.channel);
    const chatId = String(params.chatId ?? this.chatId);
    await this.sendCallback({
      channel,
      chatId,
      content,
      media: [],
      metadata: {}
    });
    return `Message sent to ${channel}:${chatId}`;
  }
}
