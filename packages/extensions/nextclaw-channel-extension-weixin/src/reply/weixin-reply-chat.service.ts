import { NcpEventType, type NcpEndpointEvent, type NcpMessagePart } from "@nextclaw/ncp";
import { type Chat, type ChatTarget } from "@nextclaw/ncp-toolkit";
import { sendWeixinFileMessage, sendWeixinImageMessage } from "../media/weixin-media.utils.js";
import { WeixinMediaPartReader } from "../media/weixin-media-part-reader.service.js";
import type { WeixinTypingController } from "../weixin-typing-controller.service.js";
import type { WeixinRuntimeAccount } from "../weixin-extension.types.js";

export const TERMINAL_NCP_EVENT_TYPES = new Set<NcpEndpointEvent["type"]>([
  NcpEventType.MessageCompleted,
  NcpEventType.MessageFailed,
  NcpEventType.RunFinished,
  NcpEventType.RunError,
]);

export type WeixinReplySession = {
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
    default:
      return "";
  }
}

export class WeixinReplyChat implements Chat {
  private readonly mediaPartReader = new WeixinMediaPartReader();

  constructor(
    private readonly deps: {
      resolveAccount: (target: ChatTarget) => WeixinRuntimeAccount;
      resolveContextToken: (target: ChatTarget, accountId: string) => string | undefined;
      sendText: (params: {
        account: WeixinRuntimeAccount;
        conversationId: string;
        text: string;
        contextToken?: string;
      }) => Promise<void>;
      typingController: WeixinTypingController;
    },
  ) {}

  readonly startTyping = async (target: ChatTarget): Promise<void> => {
    const account = this.deps.resolveAccount(target);
    const contextToken = this.deps.resolveContextToken(target, account.accountId);
    if (!contextToken) {
      return;
    }
    await this.deps.typingController.start({
      accountId: account.accountId,
      userId: target.conversationId,
      contextToken,
      baseUrl: account.baseUrl,
      token: account.token,
    });
  };

  readonly stopTyping = async (target: ChatTarget): Promise<void> => {
    const account = this.deps.resolveAccount(target);
    await this.deps.typingController.stop({
      accountId: account.accountId,
      userId: target.conversationId,
    });
  };

  readonly sendError = async (target: ChatTarget, message: string): Promise<void> => {
    if (message.trim()) {
      await this.sendText(target, message);
    }
  };

  readonly sendPart = async (target: ChatTarget, part: NcpMessagePart): Promise<void> => {
    if (part.type === "file") {
      await this.sendFilePart(target, part);
      return;
    }
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
      contextToken: this.deps.resolveContextToken(target, account.accountId),
    });
  };

  private readonly sendFilePart = async (
    target: ChatTarget,
    part: Extract<NcpMessagePart, { type: "file" }>,
  ): Promise<void> => {
    const media = await this.mediaPartReader.read(target, part);
    const account = this.deps.resolveAccount(target);
    const contextToken = this.deps.resolveContextToken(target, account.accountId);
    if (media.isImage) {
      await sendWeixinImageMessage({
        baseUrl: account.baseUrl,
        token: account.token,
        toUserId: target.conversationId,
        bytes: media.bytes,
        width: media.imageWidth,
        height: media.imageHeight,
        contextToken,
      });
      return;
    }
    await sendWeixinFileMessage({
      baseUrl: account.baseUrl,
      token: account.token,
      toUserId: target.conversationId,
      fileName: media.fileName,
      bytes: media.bytes,
      contextToken,
    });
  };
}
