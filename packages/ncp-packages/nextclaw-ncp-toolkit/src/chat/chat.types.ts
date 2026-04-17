import type { NcpEndpointEvent, NcpMessagePart } from "@nextclaw/ncp";

export type NcpEventStream = AsyncIterable<NcpEndpointEvent>;

export type ChatTarget = {
  conversationId: string;
  accountId?: string;
  resolveAssetContentPath?: (assetUri: string) => string | null;
  metadata?: Record<string, unknown>;
};

export type NcpReplyInput = {
  target: ChatTarget;
  eventStream: NcpEventStream;
};

export interface Chat {
  startTyping(target: ChatTarget): Promise<void>;
  sendPart(target: ChatTarget, part: NcpMessagePart): Promise<void>;
  sendError(target: ChatTarget, message: string): Promise<void>;
  stopTyping(target: ChatTarget): Promise<void>;
}
