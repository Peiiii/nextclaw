import { isHiddenNcpMessage, type NcpMessage } from "@nextclaw/ncp";
import {
  CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY,
  isSilentReplyNcpMessage,
} from "@nextclaw/shared";
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
    !isHiddenNcpMessage(message) &&
    !isSilentReplyNcpMessage(message) &&
    !readContextCompactionTimeline(message) &&
    !readInheritedSourceSessionId(message)
  );
}

function readContinuationTargetMessageId(message: NcpMessage): string | null {
  const value =
    message.metadata?.[CHAT_CONTINUATION_TARGET_MESSAGE_METADATA_KEY];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function appendContinuationParts(
  targetParts: NcpMessage["parts"],
  continuationParts: NcpMessage["parts"],
): NcpMessage["parts"] {
  const parts = [...targetParts];
  const firstContinuationPart = continuationParts[0];
  const lastTargetPart = parts.at(-1);
  if (
    lastTargetPart?.type === "text" &&
    firstContinuationPart?.type === "text"
  ) {
    parts[parts.length - 1] = {
      ...lastTargetPart,
      text: `${lastTargetPart.text}${firstContinuationPart.text}`,
    };
    parts.push(...continuationParts.slice(1));
    return parts;
  }
  parts.push(...continuationParts);
  return parts;
}

function mergeAssistantContinuation(
  target: NcpMessage,
  continuation: NcpMessage,
): NcpMessage {
  const startedAt = target.lifecycle?.startedAt ?? continuation.lifecycle?.startedAt;
  const endedAt = continuation.lifecycle?.endedAt ?? target.lifecycle?.endedAt;
  return {
    ...target,
    status: continuation.status,
    parts: appendContinuationParts(target.parts, continuation.parts),
    lifecycle: startedAt || endedAt ? { startedAt, endedAt } : undefined,
    metadata:
      target.metadata || continuation.metadata
        ? { ...target.metadata, ...continuation.metadata }
        : undefined,
  };
}

export function projectVisibleChatMessages(
  rawMessages: readonly NcpMessage[],
  options: { continuationRunning?: boolean } = {},
): NcpMessage[] {
  const messages: NcpMessage[] = [];
  const projectedIndexByMessageId = new Map<string, number>();
  let pendingContinuationTargetId: string | null = null;

  for (const message of rawMessages) {
    const continuationTargetId = readContinuationTargetMessageId(message);
    if (continuationTargetId && isHiddenNcpMessage(message)) {
      pendingContinuationTargetId = continuationTargetId;
      continue;
    }
    if (!isVisibleChatMessage(message)) {
      continue;
    }
    const targetIndex = pendingContinuationTargetId && message.role === "assistant"
      ? projectedIndexByMessageId.get(pendingContinuationTargetId)
      : undefined;
    if (targetIndex !== undefined && messages[targetIndex]?.role === "assistant") {
      messages[targetIndex] = mergeAssistantContinuation(
        messages[targetIndex]!,
        message,
      );
      projectedIndexByMessageId.set(message.id, targetIndex);
      pendingContinuationTargetId = null;
      continue;
    }
    pendingContinuationTargetId = null;
    projectedIndexByMessageId.set(message.id, messages.length);
    messages.push(message);
  }

  const pendingTargetIndex = pendingContinuationTargetId
    ? projectedIndexByMessageId.get(pendingContinuationTargetId)
    : undefined;
  if (options.continuationRunning && pendingTargetIndex !== undefined) {
    messages[pendingTargetIndex] = {
      ...messages[pendingTargetIndex]!,
      status: "pending",
    };
  }
  return messages;
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
  return projectVisibleChatMessages(rawMessages.slice(0, physicalIndex)).length - 1;
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
    boundaryIndex: projectVisibleChatMessages(messages.slice(0, boundaryIndex))
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
  const visibleRawMessages = projectVisibleChatMessages(params.rawMessages);
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
