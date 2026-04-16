import type {
  BaseChannel,
  InboundAttachment,
  InboundMessage,
} from "@nextclaw/core";
import type {
  ChatTarget,
  NcpReplyInput,
} from "@nextclaw/ncp-toolkit";
import type { NcpEndpointEvent } from "@nextclaw/ncp";
import type { NextclawNcpRunnerService, NcpRunnerAgent } from "./nextclaw-ncp-runner.service.js";
import { createNextclawNcpRunnerService } from "./nextclaw-ncp-runner.service.js";

type ReplyCapableChannel = BaseChannel<Record<string, unknown>> & {
  consumeNcpReply(input: NcpReplyInput): Promise<void>;
};

type ChannelReplyRoute = {
  target: ChatTarget;
  channel: ReplyCapableChannel;
};

type ResolvedInboundRoute = {
  accountId?: string | null;
};

export type ChannelReplyRouterDispatchParams = {
  agent: NcpRunnerAgent;
  route: ChannelReplyRoute;
  sessionId: string;
  content: string;
  attachments?: InboundAttachment[];
  metadata?: Record<string, unknown>;
  abortSignal?: AbortSignal;
  onEvent?: (event: NcpEndpointEvent) => void;
};

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function isReplyCapableChannel(
  channel: BaseChannel<Record<string, unknown>> | null | undefined,
): channel is ReplyCapableChannel {
  return (
    Boolean(channel) &&
    typeof (channel as Partial<ReplyCapableChannel>).consumeNcpReply === "function"
  );
}

export class ChannelReplyRouterService {
  private readonly runnerService: NextclawNcpRunnerService;

  constructor(params: {
    runnerService?: NextclawNcpRunnerService;
  } = {}) {
    this.runnerService =
      params.runnerService ?? createNextclawNcpRunnerService();
  }

  resolveRoute = (params: {
    channel: BaseChannel<Record<string, unknown>> | null | undefined;
    message: InboundMessage;
    route: ResolvedInboundRoute;
  }): ChannelReplyRoute | null => {
    if (!isReplyCapableChannel(params.channel)) {
      return null;
    }

    return {
      target: this.createTarget(params.message, params.route),
      channel: params.channel,
    };
  };

  dispatch = async (
    params: ChannelReplyRouterDispatchParams,
  ): Promise<void> => {
    const input: NcpReplyInput = {
      target: params.route.target,
      eventStream: this.runnerService.streamPromptOverNcp({
        agent: params.agent,
        sessionId: params.sessionId,
        content: params.content,
        attachments: params.attachments,
        metadata: params.metadata,
        abortSignal: params.abortSignal,
        onEvent: params.onEvent,
      }),
    };
    await params.route.channel.consumeNcpReply(input);
  };

  private createTarget = (
    message: InboundMessage,
    route: ResolvedInboundRoute,
  ): ChatTarget => {
    const metadata = structuredClone(message.metadata ?? {});
    const accountId =
      readString(route.accountId) ??
      readString(metadata.accountId) ??
      readString(metadata.account_id);

    return {
      conversationId: message.chatId,
      participantId: message.senderId,
      ...(readString(metadata.messageId) ?? readString(metadata.message_id)
        ? {
            messageId:
              readString(metadata.messageId) ??
              readString(metadata.message_id),
          }
        : {}),
      ...(readString(metadata.threadId) ?? readString(metadata.thread_id)
        ? {
            threadId:
              readString(metadata.threadId) ??
              readString(metadata.thread_id),
          }
        : {}),
      ...(accountId ? { accountId } : {}),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    };
  };
}

export function createChannelReplyRouterService(
  params: {
    runnerService?: NextclawNcpRunnerService;
  } = {},
): ChannelReplyRouterService {
  return new ChannelReplyRouterService(params);
}
