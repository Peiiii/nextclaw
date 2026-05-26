import type { OutboundMessage } from "@core/features/bus/index.js";
import { Tool, normalizeToolParams } from "./base.tools.js";

type MessageToolOptions = {
  resolveChannels?: () => readonly string[];
};

export class MessageTool extends Tool {
  private channel = "cli";
  private chatId = "direct";
  private accountId?: string;

  constructor(
    private sendCallback: (msg: OutboundMessage) => Promise<void>,
    private readonly options: MessageToolOptions = {},
  ) {
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
        action: { type: "string", enum: ["send"], description: "Action to perform" },
        content: { type: "string", description: "Message to send" },
        message: { type: "string", description: "Alias for content" },
        channel: {
          type: "string",
          description: "Exact channel id",
        },
        chatId: { type: "string", description: "Chat ID" },
        to: { type: "string", description: "Alias for chatId" },
        accountId: { type: "string", description: "Account ID for multi-account channels" },
        replyTo: { type: "string", description: "Message ID to reply to" },
        silent: { type: "boolean", description: "Send without notification where supported" }
      },
      required: []
    };
  }

  setContext = (channel: string, chatId: string, accountId?: string | null): void => {
    this.channel = channel;
    this.chatId = chatId;
    this.accountId = typeof accountId === "string" && accountId.trim().length > 0 ? accountId : undefined;
  };

  protected override validateSemanticParams = (params: Record<string, unknown>): string[] => {
    const issues: string[] = [];
    if (!this.resolveContent(params)) {
      issues.push("missing required content or message");
    }

    const explicitChannel = this.readTrimmedString(params.channel);
    const explicitChatId = this.readTrimmedString(params.chatId);
    const explicitTo = this.readTrimmedString(params.to);
    const channelIssue = this.validateExplicitChannel(explicitChannel);
    if (channelIssue) {
      issues.push(channelIssue);
    }
    if (explicitChannel && explicitChannel.toLowerCase() !== this.channel.toLowerCase() && !explicitChatId && !explicitTo) {
      issues.push(`missing required to or chatId when channel differs from current session (${this.channel}:${this.chatId})`);
    }
    return issues;
  };

  override async execute(args: unknown): Promise<string> {
    const params = normalizeToolParams(args);
    const action = params.action ? String(params.action) : "send";
    if (action !== "send") {
      return `Error: Unsupported action '${action}'`;
    }
    const validationIssues = this.validateSemanticParams(params);
    if (validationIssues.length > 0) {
      return `Error: ${validationIssues.join("; ")}`;
    }
    const content = this.resolveContent(params);
    if (!content) {
      return "Error: missing required content or message";
    }
    const explicitChannel = this.readTrimmedString(params.channel);
    const explicitChatId = this.readTrimmedString(params.chatId);
    const explicitTo = this.readTrimmedString(params.to);
    const channel = explicitChannel || this.channel;

    const chatId = explicitChatId || explicitTo || this.chatId;
    const accountId =
      typeof params.accountId === "string" && params.accountId.trim().length > 0 ? params.accountId : this.accountId;
    const replyTo = params.replyTo ? String(params.replyTo) : undefined;
    const silent = typeof params.silent === "boolean" ? params.silent : undefined;
    const metadata: Record<string, unknown> = {};
    if (silent !== undefined) {
      metadata.silent = silent;
    }
    if (accountId) {
      metadata.accountId = accountId;
      metadata.account_id = accountId;
    }
    await this.sendCallback({
      channel,
      chatId,
      content,
      replyTo,
      media: [],
      metadata
    });
    return `Message sent to ${channel}:${chatId}`;
  }

  private readTrimmedString = (value: unknown): string => typeof value === "string" ? value.trim() : "";

  private resolveKnownChannels = (): string[] => {
    const channels = this.options.resolveChannels?.() ?? [];
    return [...new Set(channels.map((channel) => channel.trim()).filter(Boolean))].sort();
  };

  private validateExplicitChannel = (channel: string): string | null => {
    if (!channel) {
      return null;
    }
    const knownChannels = this.resolveKnownChannels();
    if (knownChannels.length === 0 || knownChannels.includes(channel)) {
      return null;
    }
    return `unknown channel "${channel}"; available channels: ${knownChannels.join(", ")}`;
  };

  private resolveContent = (params: Record<string, unknown>): string | null => {
    const { content, message } = params;
    if (typeof content === "string" && content.trim().length > 0) {
      return content;
    }
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    return null;
  };
}
