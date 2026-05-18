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

export const NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION = 1;
export const NCP_AGENT_SESSION_JOURNAL_INDEX_FILE = ".ncp-agent-session-index.json";

const AUTO_SESSION_LABEL_MAX_LENGTH = 64;

export type NcpAgentSessionJournalMetadataEntry = {
  _type: "metadata";
  version: typeof NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION;
  created_at: string;
  updated_at: string;
  agent_id?: string;
  metadata: Record<string, unknown>;
};

export type NcpAgentSessionJournalEventEntry = {
  _type: "event";
  version: typeof NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION;
  seq: number;
  timestamp: string;
  event: NcpEndpointEvent;
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
  const normalized = agentId?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toIsoString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

export function createNcpAgentSessionSummary(record: AgentSessionRecord): NcpSessionSummary {
  const metadata = structuredClone(record.metadata ?? {});
  const label = readOptionalText(metadata.label) ?? resolveAutoSessionLabel(record.messages);
  if (label) {
    metadata.label = label;
  }
  const lastMessageAt = readMessageTimestamp(record.messages.at(-1));
  return {
    sessionId: record.sessionId,
    ...(normalizeNcpAgentId(record.agentId) ? { agentId: normalizeNcpAgentId(record.agentId) } : {}),
    messageCount: record.messages.length,
    ...(record.createdAt ? { createdAt: record.createdAt } : {}),
    updatedAt: record.updatedAt,
    ...(lastMessageAt ? { lastMessageAt } : {}),
    status: "idle",
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

export function createNcpAgentSessionJournalMetadataEntry(
  record: AgentSessionEventRecord,
): NcpAgentSessionJournalMetadataEntry {
  return {
    _type: "metadata",
    version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
    created_at: record.createdAt ?? record.updatedAt,
    updated_at: record.updatedAt,
    ...(normalizeNcpAgentId(record.agentId) ? { agent_id: normalizeNcpAgentId(record.agentId) } : {}),
    metadata: structuredClone(record.metadata ?? {}),
  };
}

export function upsertNcpAgentSessionSummaryEvent(params: {
  current: NcpSessionSummary | undefined;
  session: AgentSessionEventRecord;
  event: NcpEndpointEvent;
  updatedAt: string;
}): NcpSessionSummary {
  const { current, event, session, updatedAt } = params;
  const metadata = {
    ...(current?.metadata ? structuredClone(current.metadata) : {}),
    ...(session.metadata ? structuredClone(session.metadata) : {}),
  };
  const label = readOptionalText(metadata.label) ?? readSummaryLabelFromEvent(event);
  if (label) {
    metadata.label = truncateLabel(label);
  }
  const eventMessage = readMessageFromSummaryEvent(event);
  const messageCount = current
    ? current.messageCount + (eventMessage ? 1 : 0)
    : eventMessage
      ? 1
      : 0;
  const lastMessageAt = readMessageTimestamp(eventMessage) ?? current?.lastMessageAt;
  return {
    sessionId: session.sessionId,
    ...(normalizeNcpAgentId(session.agentId ?? current?.agentId) ? { agentId: normalizeNcpAgentId(session.agentId ?? current?.agentId) } : {}),
    messageCount,
    createdAt: current?.createdAt ?? session.createdAt ?? updatedAt,
    updatedAt,
    ...(lastMessageAt ? { lastMessageAt } : {}),
    status: "idle",
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

export async function replayNcpAgentSessionEvents(
  events: readonly NcpEndpointEvent[],
): Promise<NcpMessage[]> {
  const stateManager = new DefaultNcpAgentConversationStateManager();
  for (const event of events) {
    await stateManager.dispatch(createReplayEvent(event));
  }
  const snapshot = stateManager.getSnapshot();
  return [
    ...snapshot.messages.map((message) => structuredClone(message)),
    ...(snapshot.streamingMessage ? [structuredClone(snapshot.streamingMessage)] : []),
  ];
}

function createReplayEvent(event: NcpEndpointEvent): NcpEndpointEvent {
  const replayEvent = structuredClone(event);
  if (replayEvent.type === NcpEventType.MessageCompleted) {
    return {
      type: NcpEventType.MessageSent,
      payload: replayEvent.payload,
    };
  }
  if (
    replayEvent.type === NcpEventType.MessageSent &&
    replayEvent.payload.message.role === "assistant" &&
    (replayEvent.payload.message.status === "pending" || replayEvent.payload.message.status === "streaming")
  ) {
    replayEvent.payload.message.status = "final";
  }
  return replayEvent;
}

export function readNcpSessionSummaryActivityAt(summary: NcpSessionSummary): string {
  return summary.lastMessageAt ?? summary.createdAt ?? summary.updatedAt;
}

function readMessageTimestamp(message: NcpMessage | undefined): string | undefined {
  return typeof message?.timestamp === "string" && Number.isFinite(Date.parse(message.timestamp))
    ? new Date(message.timestamp).toISOString()
    : undefined;
}

function truncateLabel(value: string): string {
  const chars = Array.from(value);
  return chars.length <= AUTO_SESSION_LABEL_MAX_LENGTH
    ? value
    : `${chars.slice(0, AUTO_SESSION_LABEL_MAX_LENGTH).join("")}...`;
}

function readOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

function readMessageFromSummaryEvent(event: NcpEndpointEvent): NcpMessage | undefined {
  switch (event.type) {
    case NcpEventType.MessageSent:
      return event.payload.message;
    case NcpEventType.MessageCompleted:
      return event.payload.message;
    default:
      return undefined;
  }
}

function readSummaryLabelFromEvent(event: NcpEndpointEvent): string | null {
  const message = readMessageFromSummaryEvent(event);
  if (message?.role !== "user") {
    return null;
  }
  return resolveAutoSessionLabel([message]);
}
