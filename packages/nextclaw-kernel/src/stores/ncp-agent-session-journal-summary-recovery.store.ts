import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { NcpEventType, type NcpSessionSummary } from "@nextclaw/ncp";
import {
  createNcpAgentSessionSummary,
  isRecord,
  NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE,
  toIsoString,
} from "@kernel/utils/ncp-agent-session-journal.utils.js";
import type { NcpAgentSessionMetadataStore } from "./ncp-agent-session-metadata.store.js";
import type { NcpAgentSessionMessageProjectionStore } from "./ncp-agent-session-message-projection.store.js";

type SummaryScanState = {
  createdAt: string;
  agentId?: string;
  metadata: Record<string, unknown>;
  messageCount: number;
  lastMessageAt?: string;
  messageIds: Set<string>;
  requiresReplay: boolean;
};

export async function loadNcpAgentSessionSummary(params: {
  sessionId: string;
  journalPath: string;
  updatedAt: string;
  metadataStore: NcpAgentSessionMetadataStore;
  projectionStore: NcpAgentSessionMessageProjectionStore;
}): Promise<NcpSessionSummary | null> {
  const journalStat = await stat(params.journalPath);
  const projectionMeta = await params.projectionStore.readMeta(params.sessionId);
  if (projectionMeta && projectionMeta.projectedJournalOffset <= journalStat.size) {
    const metadata = await params.metadataStore.read(params.sessionId, {
      ...(projectionMeta.legacyMetadata?.agentId ? { agentId: projectionMeta.legacyMetadata.agentId } : {}),
      createdAt: projectionMeta.legacyMetadata?.createdAt ?? params.updatedAt,
      updatedAt: params.updatedAt,
      metadata: projectionMeta.legacyMetadata?.metadata ?? {},
    });
    const page = await params.projectionStore.listPage({ sessionId: params.sessionId, limit: 1 });
    const summary = createNcpAgentSessionSummary({
      sessionId: params.sessionId,
      ...(metadata.agentId ? { agentId: metadata.agentId } : {}),
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      metadata: metadata.metadata,
      messages: page?.messages ?? [],
    });
    return { ...summary,
      // Catalog reconstruction must preserve metadata ownership; one preview page is not a title source.
      metadata: Object.keys(metadata.metadata ?? {}).length ? metadata.metadata : undefined,
      messageCount: page?.total ?? projectionMeta.total };
  }
  return await loadNcpAgentSessionSummaryWithoutReplay({
    sessionId: params.sessionId,
    journalPath: params.journalPath,
    updatedAt: params.updatedAt,
    metadataStore: params.metadataStore,
  });
}

export async function loadNcpAgentSessionSummaryWithoutReplay(params: {
  sessionId: string;
  journalPath: string;
  updatedAt: string;
  metadataStore: NcpAgentSessionMetadataStore;
}): Promise<NcpSessionSummary | null> {
  const journalStat = await stat(params.journalPath);
  if (journalStat.size > 256 * 1024) {
    // Catalog discovery must not replay history. Read only a possible legacy metadata header.
    const handle = await open(params.journalPath, "r");
    const prefix = Buffer.alloc(64 * 1024);
    let header: Record<string, unknown> = {};
    try {
      const { bytesRead } = await handle.read(prefix, 0, prefix.length, 0);
      const newline = prefix.subarray(0, bytesRead).indexOf(10);
      if (newline >= 0) {
        const parsed = parseJournalLine(prefix.subarray(0, newline).toString("utf8"));
        if (parsed?._type === "metadata") header = parsed;
      }
    } finally { await handle.close(); }
    const metadata = await params.metadataStore.read(params.sessionId, {
      createdAt: toIsoString(header.created_at, journalStat.birthtime.toISOString()),
      updatedAt: params.updatedAt,
      ...(typeof header.agent_id === "string" ? { agentId: header.agent_id } : {}),
      metadata: isRecord(header.metadata) ? header.metadata : {},
    });
    return createNcpAgentSessionSummary({ sessionId: params.sessionId, ...metadata, messages: [] });
  }
  const stream = createReadStream(params.journalPath, { encoding: "utf-8" });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const state: SummaryScanState = {
    createdAt: params.updatedAt,
    metadata: {},
    messageCount: 0,
    messageIds: new Set(),
    requiresReplay: false,
  };
  try {
    for await (const line of lines) applyJournalSummaryLine(state, line);
  } catch {
    return null;
  } finally {
    lines.close();
    stream.destroy();
  }
  if (state.requiresReplay) return null;

  const snapshot = await params.metadataStore.read(params.sessionId, {
    ...(state.agentId ? { agentId: state.agentId } : {}),
    createdAt: state.createdAt,
    updatedAt: params.updatedAt,
    metadata: state.metadata,
  });
  const summary = createNcpAgentSessionSummary({
    sessionId: params.sessionId,
    ...(snapshot.agentId ? { agentId: snapshot.agentId } : {}),
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
    metadata: snapshot.metadata,
    messages: [],
  });
  return {
    ...summary,
    messageCount: state.messageCount,
    ...(state.lastMessageAt ? { lastMessageAt: state.lastMessageAt } : {}),
  };
}

function applyJournalSummaryLine(state: SummaryScanState, line: string): void {
  const parsed = parseJournalLine(line);
  if (!parsed) return;
  if (parsed._type === "metadata") {
    state.createdAt = toIsoString(parsed.created_at, state.createdAt);
    state.agentId = typeof parsed.agent_id === "string" ? parsed.agent_id : state.agentId;
    if (isRecord(parsed.metadata)) state.metadata = structuredClone(parsed.metadata);
    return;
  }
  if (parsed._type !== "event" || !isRecord(parsed.event)) return;
  const event = parsed.event;
  const payload = isRecord(event.payload) ? event.payload : null;
  const message = payload && isRecord(payload.message) ? payload.message : null;
  const messageId = typeof message?.id === "string"
    ? message.id
    : typeof payload?.messageId === "string" ? payload.messageId : null;
  if (!isMessageStartEvent(event.type) || !messageId || state.messageIds.has(messageId)) return;
  state.messageIds.add(messageId);
  state.messageCount += 1;
  if (isRecord(message?.metadata) && message.metadata.nextclaw_timeline_kind === "context_compaction") {
    state.requiresReplay = true;
  }
  if (!isFinalMessageEvent(event.type)) return;
  const timestamp = toIsoString(message?.timestamp, "");
  if (timestamp && (!state.lastMessageAt || timestamp > state.lastMessageAt)) state.lastMessageAt = timestamp;
}

function parseJournalLine(line: string): Record<string, unknown> | null {
  if (!line.trim()) return null;
  try {
    const parsed = JSON.parse(line) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isMessageStartEvent(type: unknown): boolean {
  return type === NcpEventType.MessageSent ||
    type === NcpEventType.MessageCompleted ||
    type === NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE ||
    type === NcpEventType.MessageTextStart ||
    type === NcpEventType.MessageReasoningStart;
}

function isFinalMessageEvent(type: unknown): boolean {
  return type === NcpEventType.MessageSent ||
    type === NcpEventType.MessageCompleted ||
    type === NCP_AGENT_SESSION_SNAPSHOT_MESSAGE_EVENT_TYPE;
}
