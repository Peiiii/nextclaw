import {
  type NcpEndpointEvent,
  type NcpMessage,
  NcpEventType,
} from "@nextclaw/ncp";
import { readCompressedContextCompactionCheckpoint, type ContextCompactionCheckpoint } from "@nextclaw/core/context-compaction-checkpoint";
import { MODEL_ROUND_PART_OFFSETS } from "@nextclaw/ncp-agent-runtime";
import { COMPACTION_RECOVERY_NOTICE } from "../services/context-compaction-summary-generation.service.js";

export const NEXTCLAW_TIMELINE_KIND_METADATA_KEY = "nextclaw_timeline_kind";
export const CONTEXT_COMPACTION_TIMELINE_KIND = "context_compaction";
export const CONTEXT_COMPACTION_PROJECTION_METADATA_KEY = "nextclaw_context_projection";
export const CONTEXT_COMPACTION_PROJECTION_KIND = "compressed_context";
export const CONTEXT_COMPACTION_PART_START = "nextclaw_compaction_part_start";
export const CONTEXT_COMPACTION_CONTINUATION_TEXT = "Continue the active run from the compressed working context. Do not repeat completed tool calls; proceed with the next required action.";
export const CONTEXT_COMPACTION_SYSTEM_PREAMBLE = [
  "Compressed working context for this session. Original messages and recorded tool outcomes remain authoritative; verify uncertain constraints and effects using session history.",
  "Continue from this context and any following messages. Do not restart onboarding or treat missing profile fields as a new-session trigger unless the compressed context says onboarding is the active user task.",
].join("\n");
export const CONTEXT_COMPACTION_RECOVERY_PREAMBLE = "Unresolved archived history: read original session history to verify old constraints and action outcomes. Only read-only recovery is permitted; ask a specific business clarification if required facts remain unknown.";

export type ContextCompactionTimelineCheckpoint = ContextCompactionCheckpoint;

function readCheckpointTimelineText(checkpoint: ContextCompactionTimelineCheckpoint): string {
  if (checkpoint.status === "compressing") {
    return "Compressing earlier context";
  }
  return checkpoint.status === "compressed"
    ? "Earlier context was auto-compacted"
    : "Context compaction failed";
}

function buildCompressedContextSystemText(checkpoint: ContextCompactionCheckpoint): string {
  return [
    CONTEXT_COMPACTION_SYSTEM_PREAMBLE,
    "",
    !checkpoint.recovery && checkpoint.summary === COMPACTION_RECOVERY_NOTICE
      ? "Earlier conversation remains archived. Follow the latest human-confirmed task conditions and read original history for any older facts needed."
      : checkpoint.summary,
    ...(checkpoint.recovery ? [
      CONTEXT_COMPACTION_RECOVERY_PREAMBLE,
    ] : []),
  ].join("\n");
}

export function readContextRecoveryState(messages: readonly NcpMessage[], fallback?: ContextCompactionCheckpoint | null): { required: boolean; checkpointId?: string; unresolvedArchive: boolean } {
  const checkpoint = readLatestContextCompactionCheckpoint(messages) ?? fallback;
  const unresolvedArchive = messages.some(message => message.metadata?.nextclaw_archived_body === true
    && (!checkpoint?.recovery || Date.parse(message.timestamp) > Date.parse(checkpoint.recovery.archiveThrough)));
  if (!checkpoint?.recovery) return { required: unresolvedArchive, unresolvedArchive };
  const checkpointId = checkpoint.recovery.checkpointId ?? checkpoint.id;
  const acknowledged = messages.some(message => message.role === "user"
    && message.metadata?.nextclaw_context_recovery_ack === checkpointId);
  return { required: !acknowledged || unresolvedArchive, checkpointId, unresolvedArchive };
}

export function readContextCompactionCheckpoint(message: NcpMessage): ContextCompactionCheckpoint | null {
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
      ...(checkpoint.recovery ? { nextclaw_context_recovery: checkpoint.recovery } : {}),
    },
  };
}

function buildMidRunContinuationMessage(params: {
  checkpoint: ContextCompactionCheckpoint;
  sessionId: string;
}): NcpMessage {
  const { checkpoint, sessionId } = params;
  return {
    id: `${sessionId}:context-compaction-continuation:${checkpoint.id}:${checkpoint.updatedAt}`,
    sessionId,
    role: "user",
    status: "final",
    timestamp: checkpoint.updatedAt,
    parts: [{
      type: "text",
      text: CONTEXT_COMPACTION_CONTINUATION_TEXT,
    }],
  };
}

function sliceMessageParts(message: NcpMessage, start: number, end?: number): NcpMessage {
  const base = Number(message.metadata?.[CONTEXT_COMPACTION_PART_START] ?? 0);
  const physicalEnd = base + message.parts.length;
  end ??= physicalEnd;
  if (!Number.isInteger(start) || start < 0 || start > end || !Number.isInteger(end)) {
    throw new Error("Invalid compacted message part boundary");
  }
  if (!message.metadata?.nextclaw_partial_projection && (start < base || end > physicalEnd)) throw new Error("Invalid compacted message part boundary");
  const localStart = Math.max(0, start - base);
  const localEnd = Math.min(message.parts.length, end - base);
  const projected = { ...message, parts: message.parts.slice(localStart, Math.max(localStart, localEnd)).map(part => structuredClone(part)), metadata: structuredClone(message.metadata ?? {}) };
  projected.metadata = { ...projected.metadata, [CONTEXT_COMPACTION_PART_START]: start };
  const offsets = projected.metadata?.[MODEL_ROUND_PART_OFFSETS];
  if (Array.isArray(offsets)) {
    projected.metadata = { ...projected.metadata, [MODEL_ROUND_PART_OFFSETS]:
      offsets.filter((offset) => offset > localStart && offset < localEnd).map((offset) => offset - localStart) };
  }
  return projected;
}

function projectMessageAfterCheckpoint(
  message: NcpMessage,
  checkpoint: ContextCompactionCheckpoint,
): NcpMessage | null {
  const retainedEnd = checkpoint.retainedMessagePartEnds?.[message.id];
  const physicalEnd = Number(message.metadata?.[CONTEXT_COMPACTION_PART_START] ?? 0) + message.parts.length;
  if (typeof retainedEnd === "number") {
    return physicalEnd > retainedEnd ? sliceMessageParts(message, retainedEnd) : null;
  }
  const coveredPartCount = checkpoint.continuationMessageCoveredPartCount;
  if (
    message.id === checkpoint.continuationMessageId &&
    typeof coveredPartCount === "number" &&
    Number.isInteger(coveredPartCount) &&
    coveredPartCount >= 0
  ) {
    return physicalEnd > coveredPartCount
      ? sliceMessageParts(message, coveredPartCount)
      : null;
  }
  return Date.parse(message.timestamp) > Date.parse(readCheckpointCoveredUntil(checkpoint))
    ? structuredClone(message)
    : null;
}

function readCheckpointMessageIds(value: unknown): Set<string> {
  return new Set(
    Array.isArray(value)
      ? value.filter((messageId): messageId is string =>
          typeof messageId === "string" && messageId.length > 0,
        )
      : [],
  );
}

function projectPreservedUserMessage(
  message: NcpMessage,
  checkpoint: ContextCompactionCheckpoint,
): NcpMessage {
  const truncated = checkpoint.truncatedPreservedUserMessage;
  if (
    truncated?.messageId === message.id &&
    typeof truncated.text === "string" &&
    truncated.text.length > 0
  ) {
    return {
      ...structuredClone(message),
      parts: [{ type: "text", text: truncated.text }],
    };
  }
  return structuredClone(message);
}

function readCheckpointCoveredUntil(checkpoint: ContextCompactionCheckpoint): string {
  return checkpoint.coveredUntil ?? checkpoint.updatedAt;
}

export function createContextCompactionMessageId(): string {
  return `context-compaction-message-${crypto.randomUUID()}`;
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

export type ContextCompactionModelProjection = {
  messages: NcpMessage[];
  stablePrefixMessageCount: number;
};

export function buildContextCompactionModelProjection(params: {
  sessionId: string;
  sessionMessages: readonly NcpMessage[];
}): ContextCompactionModelProjection {
  const { sessionId, sessionMessages } = params;
  const marker = readLatestContextCompactionMarker(sessionMessages);
  const regularMessages = sessionMessages.filter((message) => !readContextCompactionCheckpoint(message));
  if (!marker) {
    return {
      messages: regularMessages.map((message) => structuredClone(message)),
      stablePrefixMessageCount: 0,
    };
  }
  const { checkpoint: storedCheckpoint } = marker;
  const checkpoint = readContextRecoveryState(sessionMessages).required ? storedCheckpoint : { ...storedCheckpoint, recovery: undefined };
  const preservedUserMessageIds = readCheckpointMessageIds(checkpoint.preservedUserMessageIds);
  const retainedMessageIds = readCheckpointMessageIds(checkpoint.retainedMessageIds);
  const preservedUserMessages = regularMessages
    .filter((message) => message.role === "user" && preservedUserMessageIds.has(message.id))
    .map((message) => projectPreservedUserMessage(message, checkpoint))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const retainedMessages = regularMessages
    .filter((message) => retainedMessageIds.has(message.id))
    .map((message) => sliceMessageParts(message, checkpoint.retainedMessagePartStarts?.[message.id] ?? Number(message.metadata?.[CONTEXT_COMPACTION_PART_START] ?? 0),
      checkpoint.retainedMessagePartEnds?.[message.id] ?? Number(message.metadata?.[CONTEXT_COMPACTION_PART_START] ?? 0) + message.parts.length))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const projectedRegularMessages = regularMessages
    .filter((message) =>
      !preservedUserMessageIds.has(message.id) && (!retainedMessageIds.has(message.id)
        || checkpoint.retainedMessagePartEnds?.[message.id] !== undefined),
    )
    .map((message) => projectMessageAfterCheckpoint(message, checkpoint))
    .filter((message): message is NcpMessage => Boolean(message))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const stablePrefixMessages = [
    buildContextCompactionSummaryMessage({ checkpoint, sessionId }),
    ...preservedUserMessages,
    ...(checkpoint.phase === "mid-run"
      ? [buildMidRunContinuationMessage({ checkpoint, sessionId })]
      : []),
    ...retainedMessages,
  ].map((message) => structuredClone(message));
  return {
    messages: [
      ...stablePrefixMessages,
      ...projectedRegularMessages.map((message) => structuredClone(message)),
    ],
    stablePrefixMessageCount: stablePrefixMessages.length,
  };
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
