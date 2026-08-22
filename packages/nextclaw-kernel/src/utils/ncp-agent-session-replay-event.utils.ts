import { mergeToolExecutionTiming } from "@nextclaw/ncp-toolkit";
import {
  type NcpEndpointEvent,
  NcpEventType,
  type NcpMessage,
} from "@nextclaw/ncp";
import {
  NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
  NCP_SESSION_REQUEST_ACCEPTED_EVENT_TYPE,
  NCP_SESSION_REQUEST_COMPLETED_EVENT_TYPE,
  NCP_SESSION_REQUEST_FAILED_EVENT_TYPE,
  type NcpAgentSessionJournalReplayEvent,
  type NcpSessionRequestJournalEvent,
} from "./ncp-agent-session-journal.utils.js";

export type NcpAgentSessionReplayableEvent = Exclude<
  NcpAgentSessionJournalReplayEvent,
  NcpSessionRequestJournalEvent
>;
type NcpToolCallResultReplayPayload = Extract<
  NcpEndpointEvent,
  { type: NcpEventType.MessageToolCallResult }
>["payload"];

export function readSupersededSyntheticRecoveryIndexes(
  events: readonly NcpAgentSessionJournalReplayEvent[],
): Set<number> {
  const superseded = new Set<number>();
  const futureMessageIds = new Set<string>();
  const futureRunIds = new Set<string>();
  const futureToolCallMessageIds = new Map<string, string>();
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (
      event.type === NcpEventType.RunError &&
      event.payload.interrupted === true &&
      ((event.payload.messageId && futureMessageIds.has(event.payload.messageId)) ||
        (event.payload.runId && futureRunIds.has(event.payload.runId)))
    ) {
      superseded.add(index);
    }
    const toolCallId = readEventToolCallId(event);
    const mappedToolMessageId = toolCallId
      ? futureToolCallMessageIds.get(toolCallId)
      : undefined;
    if (mappedToolMessageId) {
      futureMessageIds.add(mappedToolMessageId);
    }
    if (isReplayContinuationEvent(event)) {
      const messageId = readEventMessageId(event);
      const runId = readEventRunId(event);
      if (messageId) futureMessageIds.add(messageId);
      if (runId) futureRunIds.add(runId);
      if (toolCallId && messageId) {
        futureToolCallMessageIds.set(toolCallId, messageId);
      }
    }
  }
  return superseded;
}

function isReplayContinuationEvent(event: NcpAgentSessionJournalReplayEvent): boolean {
  if (isJournalOnlyEvent(event)) {
    return false;
  }
  if (event.type === NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE) {
    return true;
  }
  return (
    readStreamingMessageId(event) !== null ||
    event.type === NcpEventType.MessageCompleted ||
    event.type === NcpEventType.RunFinished
  );
}

export function isStreamingMessageCreationEvent(event: NcpEndpointEvent): boolean {
  return event.type === NcpEventType.MessageTextStart || event.type === NcpEventType.MessageReasoningStart;
}

export function readEventMessageId(event: NcpAgentSessionJournalReplayEvent): string | null {
  if (isJournalOnlyEvent(event)) {
    return null;
  }
  const message = readMessageFromSummaryEvent(event);
  if (message?.id) {
    return message.id;
  }
  if (event.type === NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE) {
    return null;
  }
  const streamingMessageId = readStreamingMessageId(event);
  if (streamingMessageId) {
    return streamingMessageId;
  }
  const payload = "payload" in event && isRecord(event.payload)
    ? event.payload as Record<string, unknown>
    : null;
  const messageId = payload?.messageId;
  if (typeof messageId === "string" && messageId.trim()) {
    return messageId.trim();
  }
  return null;
}

export function readEventRunId(event: NcpAgentSessionJournalReplayEvent): string | null {
  if (isJournalOnlyEvent(event)) {
    return null;
  }
  if (event.type === NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE) {
    return null;
  }
  const payload = "payload" in event && isRecord(event.payload)
    ? event.payload as Record<string, unknown>
    : null;
  const runId = payload?.runId;
  if (typeof runId === "string" && runId.trim()) {
    return runId.trim();
  }
  return null;
}

function readEventToolCallId(event: NcpAgentSessionJournalReplayEvent): string | null {
  if (isJournalOnlyEvent(event)) {
    return null;
  }
  const payload = "payload" in event && isRecord(event.payload)
    ? event.payload as Record<string, unknown>
    : null;
  const toolCallId = payload?.toolCallId;
  return typeof toolCallId === "string" && toolCallId.trim() ? toolCallId.trim() : null;
}

export function createReplayEvent(
  event: NcpAgentSessionReplayableEvent,
  toolResultsByCallId: ReadonlyMap<string, NcpToolCallResultReplayPayload>
): NcpEndpointEvent {
  const replayEvent = structuredClone(event);
  const occurredAt = readReplayEventOccurredAt(replayEvent);
  const replayMessage = readMessageFromSummaryEvent(replayEvent);
  const legacyCompactionMessageId = readLegacyContextCompactionMessageId(replayMessage);
  if (replayMessage && legacyCompactionMessageId) {
    replayMessage.id = legacyCompactionMessageId;
  }
  if (
    replayMessage?.role === "assistant" &&
    (replayMessage.status === "pending" || replayMessage.status === "streaming")
  ) {
    replayMessage.status = "final";
  }
  if (
    replayEvent.type === NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE ||
    replayEvent.type === NcpEventType.MessageCompleted
  ) {
    replayEvent.payload.message = mergeReplayCompletedToolResults(replayEvent.payload.message, toolResultsByCallId);
    return {
      occurredAt,
      type: NcpEventType.MessageSent,
      payload: replayEvent.payload
    };
  }
  return replayEvent;
}

function readReplayEventOccurredAt(event: NcpAgentSessionReplayableEvent): string | undefined {
  if (!("occurredAt" in event) || typeof event.occurredAt !== "string") {
    return undefined;
  }
  return event.occurredAt;
}

function mergeReplayCompletedToolResults(
  message: NcpMessage,
  toolResultsByCallId: ReadonlyMap<string, NcpToolCallResultReplayPayload>
): NcpMessage {
  let changed = false;
  const parts = message.parts.map((part) => {
    if (part.type !== "tool-invocation" || !part.toolCallId) {
      return part;
    }
    const result = toolResultsByCallId.get(part.toolCallId);
    if (!result) {
      return part;
    }
    changed = true;
    return {
      ...part,
      state: "result" as const,
      result: result.content,
      ...(result.contentItems ? { resultContentItems: result.contentItems } : {}),
      ...(result.execution
        ? {
            execution: mergeToolExecutionTiming(result.execution, part.execution) ?? result.execution
          }
        : {})
    };
  });
  return changed ? { ...message, parts } : message;
}

function readLegacyContextCompactionMessageId(message: NcpMessage | undefined): string | null {
  const checkpoint = isRecord(message?.metadata?.checkpoint) ? message.metadata.checkpoint : null;
  const checkpointId = typeof checkpoint?.id === "string" ? checkpoint.id : "";
  const coveredCount = checkpoint?.coveredSessionMessageCount;
  const legacyId = `${message?.sessionId}:service:context-compaction:${checkpointId}`;
  return typeof coveredCount === "number" && message?.id === legacyId ? `${legacyId}:${coveredCount}` : null;
}

export function createReplayStreamingBootstrapEvent(
  event: NcpEndpointEvent,
  knownMessageIds: Set<string>
): { event: NcpEndpointEvent; messageId: string } | null {
  const messageId = readStreamingMessageId(event);
  if (!messageId || knownMessageIds.has(messageId)) {
    return null;
  }
  return {
    messageId,
    event: {
      occurredAt: event.occurredAt,
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: readEventSessionId(event),
        message: {
          id: messageId,
          sessionId: readEventSessionId(event),
          role: "assistant",
          status: "streaming",
          parts: [],
          timestamp: readReplayPayloadTimestamp(event) ?? new Date().toISOString()
        }
      }
    }
  };
}

export function readReplayMessageId(event: NcpEndpointEvent): string | null {
  const message = readMessageFromSummaryEvent(event);
  return message?.id ?? null;
}

function readEventSessionId(event: NcpEndpointEvent): string {
  const payload: Record<string, unknown> | null = "payload" in event && isRecord(event.payload) ? event.payload : null;
  const sessionId = payload?.sessionId;
  return typeof sessionId === "string" ? sessionId : "";
}

function readReplayPayloadTimestamp(event: NcpEndpointEvent): string | null {
  const payload: Record<string, unknown> | null = "payload" in event && isRecord(event.payload) ? event.payload : null;
  const timestamp = typeof payload?.timestamp === "string" ? payload.timestamp : "";
  return Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : null;
}

export function readStreamingMessageId(event: NcpEndpointEvent): string | null {
  switch (event.type) {
    case NcpEventType.MessageTextStart:
    case NcpEventType.MessageTextDelta:
    case NcpEventType.MessageTextEnd:
    case NcpEventType.MessageReasoningStart:
    case NcpEventType.MessageReasoningDelta:
    case NcpEventType.MessageReasoningEnd:
    case NcpEventType.MessageToolCallStart:
    case NcpEventType.MessageToolCallArgsDelta:
    case NcpEventType.MessageToolExecutionStarted:
      return event.payload.messageId?.trim() || null;
    default:
      return null;
  }
}

export function isJournalOnlyEvent(event: NcpAgentSessionJournalReplayEvent): event is NcpSessionRequestJournalEvent {
  return (
    event.type === NCP_SESSION_REQUEST_ACCEPTED_EVENT_TYPE ||
    event.type === NCP_SESSION_REQUEST_COMPLETED_EVENT_TYPE ||
    event.type === NCP_SESSION_REQUEST_FAILED_EVENT_TYPE
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readMessageFromSummaryEvent(event: NcpAgentSessionJournalReplayEvent): NcpMessage | undefined {
  if (
    event.type === NcpEventType.MessageSent ||
    event.type === NcpEventType.MessageCompleted ||
    event.type === NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE
  ) {
    return event.payload.message;
  }
  return undefined;
}
