import { NcpEventType, type NcpEndpointEvent, type NcpMessagePart } from "@nextclaw/ncp";
import { type Chat, type ChatTarget } from "@nextclaw/ncp-toolkit";
import type { FeishuRuntimeAccount } from "../types/feishu-extension.types.js";

export const TERMINAL_NCP_EVENT_TYPES = new Set<NcpEndpointEvent["type"]>([
  NcpEventType.MessageCompleted,
  NcpEventType.MessageFailed,
  NcpEventType.RunFinished,
  NcpEventType.RunError,
]);

export type FeishuReplySession = {
  queue: NcpEventQueue;
  consuming: Promise<void>;
};

export class NcpEventQueue implements AsyncIterable<NcpEndpointEvent> {
  private readonly events: NcpEndpointEvent[] = [];
  private waiting: ((result: IteratorResult<NcpEndpointEvent>) => void) | null = null;
  private closed = false;

  readonly push = (event: NcpEndpointEvent): void => {
    if (this.closed) {
      return;
    }
    const waiting = this.waiting;
    if (waiting) {
      this.waiting = null;
      waiting({ value: event, done: false });
      return;
    }
    this.events.push(event);
  };

  readonly close = (): void => {
    this.closed = true;
    const waiting = this.waiting;
    if (waiting) {
      this.waiting = null;
      waiting({ value: undefined, done: true });
    }
  };

  [Symbol.asyncIterator] = (): AsyncIterator<NcpEndpointEvent> => ({
    next: async () => {
      const event = this.events.shift();
      if (event) {
        return { value: event, done: false };
      }
      if (this.closed) {
        return { value: undefined, done: true };
      }
      return await new Promise<IteratorResult<NcpEndpointEvent>>((resolve) => {
        this.waiting = resolve;
      });
    },
  });
}

function renderPartText(part: NcpMessagePart): string {
  switch (part.type) {
    case "text":
    case "rich-text":
      return part.text;
    case "source":
      return [part.title ?? "", part.url ?? "", part.snippet ?? ""].filter(Boolean).join("\n");
    case "card": {
      const title = typeof part.payload.title === "string" ? part.payload.title.trim() : "";
      return title || JSON.stringify(part.payload);
    }
    case "action":
      return part.label.trim();
    case "step-start":
      return part.title?.trim() ?? "";
    case "file":
      return part.name ? `[file] ${part.name}` : "[file]";
    default:
      return "";
  }
}

export class FeishuReplyChat implements Chat {
  constructor(
    private readonly deps: {
      resolveAccount: (target: ChatTarget) => FeishuRuntimeAccount;
      sendText: (params: {
        account: FeishuRuntimeAccount;
        conversationId: string;
        text: string;
      }) => Promise<void>;
    },
  ) {}

  readonly startTyping = async (_target: ChatTarget): Promise<void> => {};

  readonly stopTyping = async (_target: ChatTarget): Promise<void> => {};

  readonly sendError = async (target: ChatTarget, message: string): Promise<void> => {
    if (message.trim()) {
      await this.sendText(target, message);
    }
  };

  readonly sendPart = async (target: ChatTarget, part: NcpMessagePart): Promise<void> => {
    const text = renderPartText(part);
    if (text.trim()) {
      await this.sendText(target, text);
    }
  };

  private readonly sendText = async (target: ChatTarget, text: string): Promise<void> => {
    const account = this.deps.resolveAccount(target);
    await this.deps.sendText({
      account,
      conversationId: target.conversationId,
      text,
    });
  };
}
