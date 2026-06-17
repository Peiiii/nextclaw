import {
  type AgentSessionEventRecord,
  type AgentSessionRecord,
  DefaultNcpAgentConversationStateManager,
} from "@nextclaw/ncp-toolkit";
import {
  type NcpEndpointEvent,
  NcpEventType,
  type NcpMessage,
  type NcpSessionSummary,
} from "@nextclaw/ncp";
import { AGENT_RUN_PEER_ID_METADATA_KEY } from "./agent-peer-session.utils.js";

export const NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION = 1;
export const NCP_AGENT_SESSION_JOURNAL_INDEX_FILE = ".ncp-agent-session-index.json";

const AUTO_SESSION_LABEL_MAX_LENGTH = 64;

export type NcpAgentSessionJournalMetadataEntry = {
  _type: "metadata";
  version: typeof NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION;
  created_at: string;
  agent_id?: string;
  metadata: Record<string, unknown>;
};

export const NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE = "session.snapshot.message";
export const NCP_SESSION_REQUEST_ACCEPTED_EVENT_TYPE = "session.request.accepted";
export const NCP_SESSION_REQUEST_COMPLETED_EVENT_TYPE = "session.request.completed";
export const NCP_SESSION_REQUEST_FAILED_EVENT_TYPE = "session.request.failed";

type NcpAgentSessionSnapshotMessageEvent = {
  type: typeof NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE;
  payload: Extract<NcpEndpointEvent, { type: NcpEventType.MessageSent }>["payload"];
};

export type NcpSessionRequestJournalEventType =
  | typeof NCP_SESSION_REQUEST_ACCEPTED_EVENT_TYPE
  | typeof NCP_SESSION_REQUEST_COMPLETED_EVENT_TYPE
  | typeof NCP_SESSION_REQUEST_FAILED_EVENT_TYPE;

export type NcpSessionRequestJournalEvent = {
  type: NcpSessionRequestJournalEventType;
  payload: {
    sessionId: string;
    request: unknown;
  };
};

export type NcpAgentSessionJournalReplayEvent =
  | NcpEndpointEvent
  | NcpAgentSessionSnapshotMessageEvent
  | NcpSessionRequestJournalEvent;

type NcpAgentSessionReplayableEvent = NcpEndpointEvent | NcpAgentSessionSnapshotMessageEvent;
type NcpToolCallResultReplayPayload = Extract<
  NcpEndpointEvent,
  { type: NcpEventType.MessageToolCallResult }
>["payload"];

export type NcpAgentSessionJournalEventEntry = {
  _type: "event";
  version: typeof NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION;
  seq: number;
  timestamp: string;
  event: NcpAgentSessionJournalReplayEvent;
};

export type NcpAgentSessionJournalIndex = {
  version: typeof NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION;
  records: NcpSessionSummary[];
};

export type LoadedNcpAgentJournalSession = {
  record: AgentSessionRecord;
  nextSeq: number;
};

export function normalizeNcpSessionId(sessionId: string): string {
  return sessionId.trim();
}

export function safeNcpSessionFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function normalizeNcpAgentId(agentId: string | undefined): string | undefined {
  return agentId?.trim().toLowerCase() || undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toIsoString(value: unknown, fallback: string): string {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

export function createNcpAgentSessionSummary(record: AgentSessionRecord): NcpSessionSummary {
  const metadata = structuredClone(record.metadata ?? {});
  const label = readOptionalText(metadata.label) ?? resolveAutoSessionLabel(record.messages);
  const peerId = readNcpAgentSessionPeerId(metadata);
  if (label) {
    metadata.label = label;
  }
  const lastMessageAt = record.messages.reduceRight<string | undefined>(
    (timestamp, message) => timestamp ?? readMessageTimestamp(message),
    undefined);
  return {
    sessionId: record.sessionId,
    peerId: peerId ?? undefined,
    ...(normalizeNcpAgentId(record.agentId) ? { agentId: normalizeNcpAgentId(record.agentId) } : {}),
    messageCount: record.messages.length,
    ...(record.createdAt ? { createdAt: record.createdAt } : {}),
    updatedAt: record.updatedAt,
    ...(lastMessageAt ? { lastMessageAt } : {}),
    status: "idle",
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

export function readNcpAgentSessionPeerId(metadata: Record<string, unknown>): string | null {
  return readOptionalText(metadata[AGENT_RUN_PEER_ID_METADATA_KEY]);
}

export function createNcpAgentSessionJournalMetadataEntry(
  record: AgentSessionEventRecord,
): NcpAgentSessionJournalMetadataEntry {
  return {
    _type: "metadata",
    version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
    created_at: record.createdAt ?? record.updatedAt,
    ...(normalizeNcpAgentId(record.agentId) ? { agent_id: normalizeNcpAgentId(record.agentId) } : {}),
    metadata: structuredClone(record.metadata ?? {}),
  };
}

export function upsertNcpAgentSessionSummaryEvent(params: {
  current: NcpSessionSummary | undefined;
  sessionId: string;
  event: NcpAgentSessionJournalReplayEvent;
  updatedAt: string;
}): NcpSessionSummary {
  const { current, event, sessionId, updatedAt } = params;
  const eventMessage = readMessageFromSummaryEvent(event);
  const messageCount = current
    ? current.messageCount + (eventMessage ? 1 : 0)
    : eventMessage
      ? 1
      : 0;
  const lastMessageAt = readMessageTimestamp(eventMessage) ?? current?.lastMessageAt;
  return {
    sessionId,
    peerId: current?.peerId,
    ...(normalizeNcpAgentId(current?.agentId) ? { agentId: normalizeNcpAgentId(current?.agentId) } : {}),
    messageCount,
    createdAt: current?.createdAt ?? updatedAt,
    updatedAt,
    ...(lastMessageAt ? { lastMessageAt } : {}),
    status: "idle",
  };
}

export async function replayNcpAgentSessionEvents(
  events: readonly NcpAgentSessionJournalReplayEvent[],
): Promise<NcpMessage[]> {
  const stateManager = new DefaultNcpAgentConversationStateManager();
  const knownMessageIds = new Set<string>();
  const toolResultsByCallId = new Map<string, NcpToolCallResultReplayPayload>();
  for (const event of events) {
    if (isJournalOnlyEvent(event)) {
      continue;
    }
    const replayEvent = createReplayEvent(event, toolResultsByCallId);
    const bootstrapEvent = createReplayStreamingBootstrapEvent(replayEvent, knownMessageIds);
    if (bootstrapEvent) {
      await stateManager.dispatch(bootstrapEvent);
    }
    rememberReplayMessageId(replayEvent, knownMessageIds);
    await stateManager.dispatch(replayEvent);
    if (replayEvent.type === NcpEventType.MessageToolCallResult) {
      toolResultsByCallId.set(replayEvent.payload.toolCallId, replayEvent.payload);
    }
  }
  const snapshot = stateManager.getSnapshot();
  return [
    ...snapshot.messages.map((message) => structuredClone(message)),
    ...(snapshot.streamingMessage ? [structuredClone(snapshot.streamingMessage)] : []),
  ];
}

function createReplayEvent(
  event: NcpAgentSessionReplayableEvent,
  toolResultsByCallId: ReadonlyMap<string, NcpToolCallResultReplayPayload>,
): NcpEndpointEvent {
  const replayEvent = structuredClone(event);
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
    replayEvent.payload.message = mergeReplayCompletedToolResults(
      replayEvent.payload.message,
      toolResultsByCallId,
    );
    return { type: NcpEventType.MessageSent, payload: replayEvent.payload };
  }
  return replayEvent;
}

function mergeReplayCompletedToolResults(
  message: NcpMessage,
  toolResultsByCallId: ReadonlyMap<string, NcpToolCallResultReplayPayload>,
): NcpMessage {
  let changed = false;
  const parts = message.parts.map((part) => {
    if (part.type !== "tool-invocation" || part.state === "result" || !part.toolCallId) {
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
      resultContentItems: result.contentItems,
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

function createReplayStreamingBootstrapEvent(
  event: NcpEndpointEvent,
  knownMessageIds: Set<string>,
): NcpEndpointEvent | null {
  const messageId = readStreamingMessageId(event);
  if (!messageId || knownMessageIds.has(messageId)) {
    return null;
  }
  knownMessageIds.add(messageId);
  return {
    type: NcpEventType.MessageSent,
    payload: {
      sessionId: readEventSessionId(event),
      message: {
        id: messageId,
        sessionId: readEventSessionId(event),
        role: "assistant",
        status: "streaming",
        parts: [],
        timestamp: readReplayPayloadTimestamp(event) ?? new Date().toISOString(),
      },
    },
  };
}

function rememberReplayMessageId(
  event: NcpEndpointEvent,
  knownMessageIds: Set<string>,
): void {
  const message = readMessageFromSummaryEvent(event);
  if (message?.id) {
    knownMessageIds.add(message.id);
  }
}

function readEventSessionId(event: NcpEndpointEvent): string {
  const payload: Record<string, unknown> | null =
    "payload" in event && isRecord(event.payload) ? event.payload : null;
  const sessionId = payload?.sessionId;
  return typeof sessionId === "string" ? sessionId : "";
}

function readReplayPayloadTimestamp(event: NcpEndpointEvent): string | null {
  const payload: Record<string, unknown> | null =
    "payload" in event && isRecord(event.payload) ? event.payload : null;
  const timestamp = typeof payload?.timestamp === "string" ? payload.timestamp : "";
  return Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : null;
}

function readStreamingMessageId(event: NcpEndpointEvent): string | null {
  switch (event.type) {
    case NcpEventType.MessageTextStart:
    case NcpEventType.MessageTextDelta:
    case NcpEventType.MessageTextEnd:
    case NcpEventType.MessageReasoningStart:
    case NcpEventType.MessageReasoningDelta:
    case NcpEventType.MessageReasoningEnd:
    case NcpEventType.MessageToolCallStart:
    case NcpEventType.MessageToolCallArgsDelta:
      return event.payload.messageId?.trim() || null;
    default:
      return null;
  }
}

function isJournalOnlyEvent(event: NcpAgentSessionJournalReplayEvent): event is NcpSessionRequestJournalEvent {
  return (
    event.type === NCP_SESSION_REQUEST_ACCEPTED_EVENT_TYPE ||
    event.type === NCP_SESSION_REQUEST_COMPLETED_EVENT_TYPE ||
    event.type === NCP_SESSION_REQUEST_FAILED_EVENT_TYPE
  );
}

export function readNcpSessionSummaryActivityAt(summary: NcpSessionSummary): string {
  return summary.lastMessageAt ?? summary.createdAt ?? summary.updatedAt;
}

function readMessageTimestamp(message: NcpMessage | undefined): string | undefined {
  return message?.status === "final" ? toIsoString(message.timestamp, "") || undefined : undefined;
}

function truncateLabel(value: string): string {
  const chars = Array.from(value);
  return chars.length <= AUTO_SESSION_LABEL_MAX_LENGTH
    ? value
    : `${chars.slice(0, AUTO_SESSION_LABEL_MAX_LENGTH).join("")}...`;
}

function readOptionalText(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function resolveAutoSessionLabel(messages: readonly NcpMessage[]): string | null {
  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }
    for (const part of message.parts) {
      if (part.type === "text" || part.type === "rich-text") {
        const text = readOptionalText(part.text);
        if (text) {
          return truncateLabel(text);
        }
      }
    }
  }
  return null;
}

function readMessageFromSummaryEvent(event: NcpAgentSessionJournalReplayEvent): NcpMessage | undefined {
  if (
    event.type === NcpEventType.MessageSent ||
    event.type === NcpEventType.MessageCompleted ||
    event.type === NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE
  ) {
    return event.payload.message;
  }
  return undefined;
}
