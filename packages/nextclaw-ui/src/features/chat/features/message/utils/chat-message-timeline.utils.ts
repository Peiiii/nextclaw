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
export const CONTEXT_COMPACTION_PART_EXTENSION_TYPE =
  "nextclaw.context-compaction";

export type ContextCompactionPartData = {
  id: string;
  checkpoint: ContextCompactionTimelineView;
};

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
  return [...targetParts, ...continuationParts];
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

type VisibleChatMessageProjection = {
  messages: NcpMessage[];
  inlineCompactionMessageIds: Set<string>;
};

type ProjectedMessagePartAnchor = {
  messageIndex: number;
  partOffset: number;
};

type InlineCompactionPlacement = {
  boundaryIndex: number;
  checkpoint: ContextCompactionTimelineView;
  messageIndex: number;
  rawOrder: number;
  serviceMessageId: string;
};

function projectVisibleChatMessageState(
  rawMessages: readonly NcpMessage[],
  options: { continuationRunning?: boolean } = {},
): VisibleChatMessageProjection {
  const messages: NcpMessage[] = [];
  const projectedIndexByMessageId = new Map<string, number>();
  const partAnchorByMessageId = new Map<string, ProjectedMessagePartAnchor>();
  const partCountByMessageId = new Map(
    rawMessages.map((message) => [message.id, message.parts.length]),
  );
  const inlineCompactions: InlineCompactionPlacement[] = [];
  const inlineCompactionMessageIds = new Set<string>();
  let pendingContinuationTargetId: string | null = null;

  rawMessages.forEach((message, rawOrder) => {
    const checkpoint = readContextCompactionTimeline(message);
    const explicitMessageId = checkpoint?.continuationMessageId;
    const legacyPreRunMessageId = checkpoint?.phase === "pre-run"
      ? pendingContinuationTargetId
      : null;
    const placementMessageId = explicitMessageId ?? legacyPreRunMessageId;
    const coveredPartCount = checkpoint?.continuationMessageCoveredPartCount
      ?? (legacyPreRunMessageId
        ? partCountByMessageId.get(legacyPreRunMessageId)
        : undefined);
    const anchor = placementMessageId
      ? partAnchorByMessageId.get(placementMessageId)
      : undefined;
    if (
      (checkpoint?.phase === "mid-run" || checkpoint?.phase === "pre-run") &&
      anchor &&
      coveredPartCount !== undefined
    ) {
      inlineCompactions.push({
        boundaryIndex: anchor.partOffset + coveredPartCount,
        checkpoint,
        messageIndex: anchor.messageIndex,
        rawOrder,
        serviceMessageId: message.id,
      });
      inlineCompactionMessageIds.add(message.id);
      return;
    }
    const continuationTargetId = readContinuationTargetMessageId(message);
    if (continuationTargetId && isHiddenNcpMessage(message)) {
      pendingContinuationTargetId = continuationTargetId;
      return;
    }
    if (!isVisibleChatMessage(message)) {
      return;
    }
    const targetIndex = pendingContinuationTargetId && message.role === "assistant"
      ? projectedIndexByMessageId.get(pendingContinuationTargetId)
      : undefined;
    if (targetIndex !== undefined && messages[targetIndex]?.role === "assistant") {
      const partOffset = messages[targetIndex]!.parts.length;
      messages[targetIndex] = mergeAssistantContinuation(
        messages[targetIndex]!,
        message,
      );
      projectedIndexByMessageId.set(message.id, targetIndex);
      partAnchorByMessageId.set(message.id, {
        messageIndex: targetIndex,
        partOffset,
      });
      pendingContinuationTargetId = null;
      return;
    }
    pendingContinuationTargetId = null;
    projectedIndexByMessageId.set(message.id, messages.length);
    partAnchorByMessageId.set(message.id, {
      messageIndex: messages.length,
      partOffset: 0,
    });
    messages.push(message);
  });

  const placementsByMessageIndex = new Map<number, InlineCompactionPlacement[]>();
  for (const placement of inlineCompactions) {
    const placements = placementsByMessageIndex.get(placement.messageIndex) ?? [];
    placements.push(placement);
    placementsByMessageIndex.set(placement.messageIndex, placements);
  }
  for (const [messageIndex, placements] of placementsByMessageIndex) {
    const message = messages[messageIndex];
    if (!message) continue;
    const parts = [...message.parts];
    let insertedCount = 0;
    placements
      .sort((left, right) =>
        left.boundaryIndex - right.boundaryIndex || left.rawOrder - right.rawOrder,
      )
      .forEach((placement) => {
        if (
          !Number.isSafeInteger(placement.boundaryIndex) ||
          placement.boundaryIndex < 0 ||
          placement.boundaryIndex > message.parts.length
        ) {
          inlineCompactionMessageIds.delete(placement.serviceMessageId);
          return;
        }
        parts.splice(placement.boundaryIndex + insertedCount, 0, {
          type: "extension",
          extensionType: CONTEXT_COMPACTION_PART_EXTENSION_TYPE,
          data: {
            id: placement.serviceMessageId,
            checkpoint: placement.checkpoint,
          } satisfies ContextCompactionPartData,
        });
        insertedCount += 1;
      });
    messages[messageIndex] = { ...message, parts };
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
  return { messages, inlineCompactionMessageIds };
}

export function projectVisibleChatMessages(
  rawMessages: readonly NcpMessage[],
  options: { continuationRunning?: boolean } = {},
): NcpMessage[] {
  return projectVisibleChatMessageState(rawMessages, options).messages;
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
  const projection = projectVisibleChatMessageState(params.rawMessages);
  const visibleRawMessages = projection.messages;
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
      } => Boolean(
        entry.checkpoint &&
        !projection.inlineCompactionMessageIds.has(entry.rawMessageId),
      ),
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
