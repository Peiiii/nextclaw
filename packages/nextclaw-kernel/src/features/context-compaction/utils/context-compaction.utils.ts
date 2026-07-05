import { randomUUID } from "node:crypto";
import {
  type NcpEndpointEvent,
  type NcpMessage,
  NcpEventType,
} from "@nextclaw/ncp";
import { readCompressedContextCompactionCheckpoint, type ContextCompactionCheckpoint } from "@nextclaw/core";

export const NEXTCLAW_TIMELINE_KIND_METADATA_KEY = "nextclaw_timeline_kind";
export const CONTEXT_COMPACTION_TIMELINE_KIND = "context_compaction";
export const CONTEXT_COMPACTION_PROJECTION_METADATA_KEY = "nextclaw_context_projection";
export const CONTEXT_COMPACTION_PROJECTION_KIND = "compressed_context";

export type ContextCompactionTimelineCheckpoint = ContextCompactionCheckpoint;

function readCheckpointTimelineText(checkpoint: ContextCompactionTimelineCheckpoint): string {
  return checkpoint.status === "compressing"
    ? "Compressing earlier context"
    : "Earlier context was auto-compacted";
}

function buildCompressedContextSystemText(checkpoint: ContextCompactionCheckpoint): string {
  return [
    "Authoritative compressed prior conversation context for this session.",
    "Continue from this context and the latest user message. Do not restart onboarding or treat missing profile fields as a new-session trigger unless the compressed context says onboarding is the active user task.",
    "",
    checkpoint.summary,
  ].join("\n");
}

function readContextCompactionCheckpoint(message: NcpMessage): ContextCompactionCheckpoint | null {
  const metadata = message.metadata;
  return metadata?.[NEXTCLAW_TIMELINE_KIND_METADATA_KEY] === CONTEXT_COMPACTION_TIMELINE_KIND
    ? readCompressedContextCompactionCheckpoint(metadata.checkpoint)
    : null;
}

function readLatestContextCompactionMarker(sessionMessages: readonly NcpMessage[]) {
  return sessionMessages.reduce<{ checkpoint: ContextCompactionCheckpoint } | null>((marker, message) => {
    const candidateCheckpoint = readContextCompactionCheckpoint(message);
    return candidateCheckpoint && (!marker || Date.parse(candidateCheckpoint.updatedAt) >= Date.parse(marker.checkpoint.updatedAt))
      ? { checkpoint: candidateCheckpoint }
      : marker;
  }, null);
}

function buildContextCompactionSummaryMessage(params: {
  checkpoint: ContextCompactionCheckpoint;
  sessionId: string;
}): NcpMessage {
  const { checkpoint, sessionId } = params;
  return {
    id: `${sessionId}:context-compaction-summary:${checkpoint.id}:${checkpoint.updatedAt}`,
    sessionId,
    role: "service",
    status: "final",
    timestamp: checkpoint.updatedAt,
    parts: [{ type: "text", text: buildCompressedContextSystemText(checkpoint) }],
    metadata: {
      [CONTEXT_COMPACTION_PROJECTION_METADATA_KEY]: CONTEXT_COMPACTION_PROJECTION_KIND,
    },
  };
}

function readCheckpointCoveredUntil(checkpoint: ContextCompactionCheckpoint): string {
  return checkpoint.coveredUntil ?? checkpoint.updatedAt;
}

export function createContextCompactionMessageId(): string {
  return `context-compaction-message-${randomUUID()}`;
}

export function buildContextCompactionTimelineNcpMessage(params: {
  messageId: string;
  sessionId: string;
  checkpoint: ContextCompactionTimelineCheckpoint;
}): NcpMessage {
  const { checkpoint, messageId, sessionId } = params;
  const text = readCheckpointTimelineText(checkpoint);
  return {
    id: messageId,
    sessionId,
    role: "service",
    status: "final",
    timestamp: checkpoint.updatedAt,
    parts: [{ type: "text", text }],
    metadata: {
      [NEXTCLAW_TIMELINE_KIND_METADATA_KEY]: CONTEXT_COMPACTION_TIMELINE_KIND,
      checkpoint,
    },
  };
}

export function isContextCompactionTimelineMessage(message: { metadata?: Record<string, unknown> | undefined } | null | undefined): boolean {
  return message?.metadata?.[NEXTCLAW_TIMELINE_KIND_METADATA_KEY] === CONTEXT_COMPACTION_TIMELINE_KIND;
}

export function isContextCompactionProjectionMessage(message: { metadata?: Record<string, unknown> | undefined } | null | undefined): boolean {
  return message?.metadata?.[CONTEXT_COMPACTION_PROJECTION_METADATA_KEY] === CONTEXT_COMPACTION_PROJECTION_KIND;
}

export function readLatestContextCompactionCheckpoint(sessionMessages: readonly NcpMessage[]): ContextCompactionCheckpoint | null {
  return readLatestContextCompactionMarker(sessionMessages)?.checkpoint ?? null;
}

export function buildContextCompactionModelInput(params: {
  sessionId: string;
  sessionMessages: readonly NcpMessage[];
}): NcpMessage[] {
  const { sessionId, sessionMessages } = params;
  const marker = readLatestContextCompactionMarker(sessionMessages);
  const regularMessages = sessionMessages.filter((message) => !readContextCompactionCheckpoint(message));
  if (!marker) {
    return regularMessages.map((message) => structuredClone(message));
  }
  const { checkpoint } = marker;
  const coveredUntil = readCheckpointCoveredUntil(checkpoint);
  return [
    buildContextCompactionSummaryMessage({ checkpoint, sessionId }),
    ...regularMessages
      .filter((message) => Date.parse(message.timestamp) > Date.parse(coveredUntil))
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp)),
  ].map((message) => structuredClone(message));
}

export function readContextWindowEventSessionId(event: NcpEndpointEvent): string | null {
  const payload = "payload" in event ? event.payload : null;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return "sessionId" in payload && typeof payload.sessionId === "string"
    ? payload.sessionId.trim() || null
    : null;
}

export function isContextWindowSnapshot(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createContextWindowSignature(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

export function shouldRefreshContextWindowDuringStream(event: NcpEndpointEvent): boolean {
  switch (event.type) {
    case NcpEventType.MessageTextStart:
    case NcpEventType.MessageTextDelta:
    case NcpEventType.MessageTextEnd:
    case NcpEventType.MessageReasoningStart:
    case NcpEventType.MessageReasoningDelta:
    case NcpEventType.MessageReasoningEnd:
    case NcpEventType.MessageToolCallStart:
    case NcpEventType.MessageToolCallArgs:
    case NcpEventType.MessageToolCallArgsDelta:
    case NcpEventType.MessageToolCallEnd:
    case NcpEventType.MessageToolCallResult:
      return true;
    default:
      return false;
  }
}

export function shouldRefreshContextWindowImmediately(event: NcpEndpointEvent): boolean {
  switch (event.type) {
    case NcpEventType.MessageSent:
    case NcpEventType.MessageCompleted:
    case NcpEventType.MessageFailed:
    case NcpEventType.MessageAbort:
    case NcpEventType.RunFinished:
    case NcpEventType.RunError:
      return true;
    default:
      return false;
  }
}
