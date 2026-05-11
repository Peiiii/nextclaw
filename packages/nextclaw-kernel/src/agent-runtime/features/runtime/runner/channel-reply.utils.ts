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
import { streamPromptOverNcp, type NcpRunnerAgent } from "./ncp-event-stream.utils.js";

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

export function resolveChannelReplyRoute(params: {
  channel: BaseChannel<Record<string, unknown>> | null | undefined;
  message: InboundMessage;
  route: ResolvedInboundRoute;
}): ChannelReplyRoute | null {
  const { channel, message, route } = params;
  if (!isReplyCapableChannel(channel)) {
    return null;
  }

  const metadata = structuredClone(message.metadata ?? {});
  const accountId =
    readString(route.accountId) ??
    readString(metadata.accountId) ??
    readString(metadata.account_id);

  return {
    target: {
      conversationId: message.chatId,
      ...(accountId ? { accountId } : {}),
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
    },
    channel,
  };
}

export async function dispatchChannelReplyRoute(
  params: ChannelReplyRouterDispatchParams,
): Promise<void> {
  const {
    abortSignal,
    agent,
    attachments,
    content,
    metadata,
    onEvent,
    route,
    sessionId,
  } = params;
  const input: NcpReplyInput = {
    target: {
      ...route.target,
      ...(agent.assetApi?.resolveContentPath
        ? {
            resolveAssetContentPath:
              agent.assetApi.resolveContentPath,
          }
        : {}),
    },
    eventStream: streamPromptOverNcp({
      agent,
      sessionId,
      content,
      attachments,
      metadata,
      abortSignal,
      onEvent,
    }),
  };
  await route.channel.consumeNcpReply(input);
}
