import {
  type AgentSessionEventRecord,
  type AgentSessionRecord,
} from "@nextclaw/ncp-toolkit";
import {
  type NcpEndpointEvent,
  NcpEventType,
  type NcpMessage,
  type NcpSessionSummary,
} from "@nextclaw/ncp";
import { AGENT_RUN_PEER_ID_METADATA_KEY } from "./agent-peer-session.utils.js";
import { resolveNcpAgentSessionLabel } from "./ncp-agent-session-label.utils.js";

export const NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION = 1;
export const NCP_AGENT_SESSION_JOURNAL_INDEX_FILE = ".ncp-agent-session-index.json";

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
  journalOffset: number;
  projectedJournalOffset: number;
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
  const label = readOptionalText(metadata.label) ?? resolveNcpAgentSessionLabel(record.messages);
  const peerId = readNcpAgentSessionPeerId(metadata);
  if (label) {
    metadata.label = label;
  }
  const lastMessageAt = record.messages.reduceRight<string | undefined>(
    (timestamp, message) => timestamp ?? readMessageTimestamp(message),
    undefined
  );
  return {
    sessionId: record.sessionId,
    peerId: peerId ?? undefined,
    ...(normalizeNcpAgentId(record.agentId) ? { agentId: normalizeNcpAgentId(record.agentId) } : {}),
    messageCount: record.messages.length,
    ...(record.createdAt ? { createdAt: record.createdAt } : {}),
    updatedAt: record.updatedAt,
    ...(lastMessageAt ? { lastMessageAt } : {}),
    status: "idle",
    ...(Object.keys(metadata).length > 0 ? { metadata } : {})
  };
}

export function readNcpAgentSessionPeerId(metadata: Record<string, unknown>): string | null {
  return readOptionalText(metadata[AGENT_RUN_PEER_ID_METADATA_KEY]);
}

export function createNcpAgentSessionJournalMetadataEntry(
  record: AgentSessionEventRecord
): NcpAgentSessionJournalMetadataEntry {
  return {
    _type: "metadata",
    version: NCP_AGENT_SESSION_JOURNAL_ENTRY_VERSION,
    created_at: record.createdAt ?? record.updatedAt,
    ...(normalizeNcpAgentId(record.agentId) ? { agent_id: normalizeNcpAgentId(record.agentId) } : {}),
    metadata: structuredClone(record.metadata ?? {})
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
  const messageCount = current ? current.messageCount + (eventMessage ? 1 : 0) : eventMessage ? 1 : 0;
  const lastMessageAt = readMessageTimestamp(eventMessage) ?? current?.lastMessageAt;
  return {
    sessionId,
    peerId: current?.peerId,
    ...(normalizeNcpAgentId(current?.agentId) ? { agentId: normalizeNcpAgentId(current?.agentId) } : {}),
    messageCount,
    createdAt: current?.createdAt ?? updatedAt,
    updatedAt,
    ...(lastMessageAt ? { lastMessageAt } : {}),
    status: "idle"
  };
}

export { replayNcpAgentSessionEvents } from "./ncp-agent-session-replay.utils.js";

export function readNcpSessionSummaryActivityAt(summary: NcpSessionSummary): string {
  return summary.lastMessageAt ?? summary.createdAt ?? summary.updatedAt;
}

function readMessageTimestamp(message: NcpMessage | undefined): string | undefined {
  return message?.status === "final" ? toIsoString(message.timestamp, "") || undefined : undefined;
}

function readOptionalText(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
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
