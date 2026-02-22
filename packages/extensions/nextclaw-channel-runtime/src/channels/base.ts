import type { MessageBus } from "../bus/queue.js";
import type { InboundAttachment, InboundMessage, OutboundMessage } from "../bus/events.js";

export abstract class BaseChannel<TConfig extends Record<string, unknown>> {
  protected running = false;

  constructor(protected config: TConfig, protected bus: MessageBus) {}

  abstract get name(): string;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract send(msg: OutboundMessage): Promise<void>;

  async handleControlMessage(_msg: OutboundMessage): Promise<boolean> {
    return false;
  }

  isAllowed(senderId: string): boolean {
    const allowList = (this.config as { allowFrom?: string[] }).allowFrom ?? [];
    if (!allowList.length) {
      return true;
    }
    if (allowList.includes(senderId)) {
      return true;
    }
    if (senderId.includes("|")) {
      return senderId.split("|").some((part) => allowList.includes(part));
    }
    return false;
  }

  protected async handleMessage(params: {
    senderId: string;
    chatId: string;
    content: string;
    attachments?: InboundAttachment[];
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.isAllowed(params.senderId)) {
      return;
    }
    const msg: InboundMessage = {
      channel: this.name,
      senderId: params.senderId,
      chatId: params.chatId,
      content: params.content,
      timestamp: new Date(),
      attachments: params.attachments ?? [],
      metadata: params.metadata ?? {}
    };
    await this.bus.publishInbound(msg);
  }

  get isRunning(): boolean {
    return this.running;
  }
}
