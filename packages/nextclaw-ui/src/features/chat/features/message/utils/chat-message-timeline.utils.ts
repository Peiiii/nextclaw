import type { NcpMessage } from "@nextclaw/ncp";
import type { ChatMessageViewModel } from "@nextclaw/agent-chat-ui";
import {
  readContextCompactionTimeline,
  type ContextCompactionTimelineView,
} from "@/features/chat/features/session/utils/ncp-session-context-metadata.utils";

const INHERITED_FROM_SESSION_METADATA_KEY = "inherited_from_session_id";

export type ContextInheritanceTimelineView = {
  sourceSessionId: string;
  inheritedMessageCount: number;
};

type ContextInheritanceTimelineBoundary = ContextInheritanceTimelineView & {
  boundaryIndex: number;
};

export type ChatTimelineItem =
  | {
      kind: "message";
      key: string;
      message: ChatMessageViewModel;
    }
  | {
      kind: "compaction";
      key: string;
      checkpoint: ContextCompactionTimelineView;
    }
  | {
      kind: "context-inheritance";
      key: string;
      inheritance: ContextInheritanceTimelineView;
    }
  | {
      kind: "typing";
      key: "typing";
    }
  | {
      kind: "empty";
      key: "empty";
    };

function readInheritedSourceSessionId(message: NcpMessage): string | null {
  const value = message.metadata?.[INHERITED_FROM_SESSION_METADATA_KEY];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isVisibleChatMessage(message: NcpMessage): boolean {
  return (
    !readContextCompactionTimeline(message) &&
    !readInheritedSourceSessionId(message)
  );
}

function resolveCompactionBoundaryIndex(params: {
  rawMessages: readonly NcpMessage[];
  visibleRawMessages: readonly NcpMessage[];
  rawMessageId: string;
}): number {
  const { rawMessageId, rawMessages, visibleRawMessages } = params;
  const physicalIndex = rawMessages.findIndex(
    (message) => message.id === rawMessageId,
  );
  if (physicalIndex < 0) {
    return visibleRawMessages.length - 1;
  }
  return (
    rawMessages.slice(0, physicalIndex).filter(isVisibleChatMessage).length - 1
  );
}

function resolveContextInheritanceBoundary(
  messages: readonly NcpMessage[],
): ContextInheritanceTimelineBoundary | null {
  const boundaryIndex = messages.findIndex((message) =>
    readInheritedSourceSessionId(message),
  );
  if (boundaryIndex < 0) {
    return null;
  }
  const sourceSessionId = readInheritedSourceSessionId(messages[boundaryIndex]);
  if (!sourceSessionId) {
    return null;
  }
  return {
    boundaryIndex: messages.slice(0, boundaryIndex).filter(isVisibleChatMessage)
      .length,
    sourceSessionId,
    inheritedMessageCount: messages.filter(
      (message) => readInheritedSourceSessionId(message) === sourceSessionId,
    ).length,
  };
}

export function buildChatMessageTimelineItems(params: {
  rawMessages: readonly NcpMessage[];
  messages: ChatMessageViewModel[];
}): ChatTimelineItem[] {
  const visibleRawMessages = params.rawMessages.filter(isVisibleChatMessage);
  const checkpoints = params.rawMessages
    .map((message) => ({
      rawMessageId: message.id,
      checkpoint: readContextCompactionTimeline(message),
    }))
    .filter(
      (
        entry,
      ): entry is {
        rawMessageId: string;
        checkpoint: ContextCompactionTimelineView;
      } => Boolean(entry.checkpoint),
    )
    .map((entry) => ({
      key: `compaction:${entry.rawMessageId}`,
      checkpoint: entry.checkpoint,
      boundaryIndex: resolveCompactionBoundaryIndex({
        rawMessages: params.rawMessages,
        visibleRawMessages,
        rawMessageId: entry.rawMessageId,
      }),
    }))
    .sort((left, right) => left.boundaryIndex - right.boundaryIndex);
  const contextInheritance = resolveContextInheritanceBoundary(
    params.rawMessages,
  );
  const items: ChatTimelineItem[] = [];
  let pendingMessages: ChatMessageViewModel[] = [];
  let checkpointCursor = 0;
  const flushPendingMessages = () => {
    if (pendingMessages.length === 0) {
      return;
    }
    items.push(
      ...pendingMessages.map((message) => ({
        kind: "message" as const,
        key: `message:${message.id}`,
        message,
      })),
    );
    pendingMessages = [];
  };

  visibleRawMessages.forEach((rawMessage, index) => {
    if (contextInheritance?.boundaryIndex === index) {
      flushPendingMessages();
      items.push({
        kind: "context-inheritance",
        key: `context-inheritance:${contextInheritance.sourceSessionId}`,
        inheritance: contextInheritance,
      });
    }
    const message = params.messages[index];
    if (message) {
      pendingMessages.push(message);
    }
    while (
      checkpointCursor < checkpoints.length &&
      checkpoints[checkpointCursor]?.boundaryIndex <= index
    ) {
      const currentCheckpoint = checkpoints[checkpointCursor];
      flushPendingMessages();
      items.push({
        kind: "compaction",
        key: currentCheckpoint.key,
        checkpoint: currentCheckpoint.checkpoint,
      });
      checkpointCursor += 1;
    }
  });
  if (contextInheritance?.boundaryIndex === visibleRawMessages.length) {
    flushPendingMessages();
    items.push({
      kind: "context-inheritance",
      key: `context-inheritance:${contextInheritance.sourceSessionId}`,
      inheritance: contextInheritance,
    });
  }
  while (checkpointCursor < checkpoints.length) {
    const currentCheckpoint = checkpoints[checkpointCursor];
    flushPendingMessages();
    items.push({
      kind: "compaction",
      key: currentCheckpoint.key,
      checkpoint: currentCheckpoint.checkpoint,
    });
    checkpointCursor += 1;
  }
  flushPendingMessages();
  if (items.length === 0) {
    items.push({ kind: "empty", key: "empty" });
  }
  return items;
}
