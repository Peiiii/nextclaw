import type { NcpMessage } from "@nextclaw/ncp";
import { SessionMessageCursorError } from "@kernel/types/session.types.js";

const OFFSET_FIELD_WIDTH = 20;

export const NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION = 6;
export const MESSAGE_PROJECTION_OFFSET_RECORD_BYTES = OFFSET_FIELD_WIDTH * 2 + 2;

export type NcpAgentSessionMessageProjectionMeta = {
  version: typeof NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION;
  sessionId: string;
  total: number;
  projectedJournalOffset: number;
  dataBytes: number;
  contextWindow: Record<string, unknown> | null;
  activeMessageId: string | null;
  pendingCompactionMessageIds: string[];
};

export type NcpAgentSessionMessageLocation = {
  offset: number;
  length: number;
};

export function serializeNcpAgentSessionMessage(message: NcpMessage): Buffer {
  return Buffer.from(`${JSON.stringify(message)}\n`, "utf-8");
}

export function serializeNcpAgentSessionMessageLocation(location: NcpAgentSessionMessageLocation): string {
  const offset = String(location.offset).padStart(OFFSET_FIELD_WIDTH, "0");
  const length = String(location.length).padStart(OFFSET_FIELD_WIDTH, "0");
  if (offset.length !== OFFSET_FIELD_WIDTH || length.length !== OFFSET_FIELD_WIDTH) {
    throw new Error("Session message projection exceeded its supported file size.");
  }
  return `${offset}:${length}\n`;
}

export function parseNcpAgentSessionMessageLocation(value: string): NcpAgentSessionMessageLocation {
  const match = /^(\d{20}):(\d{20})\n$/.exec(value);
  const offset = Number(match?.[1]);
  const length = Number(match?.[2]);
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 1) {
    throw new Error("Session message projection contains an invalid offset record.");
  }
  return { offset, length };
}

export function encodeNcpAgentSessionMessageCursor(ordinal: number): string {
  return Buffer.from(`v1:${ordinal}`, "utf-8").toString("base64url");
}

export function decodeNcpAgentSessionMessageCursor(cursor: string, maximumBoundary: number): number {
  let decoded = "";
  try {
    decoded = Buffer.from(cursor, "base64url").toString("utf-8");
  } catch {
    throw new SessionMessageCursorError();
  }
  const match = /^v1:([1-9]\d*)$/.exec(decoded);
  const ordinal = Number(match?.[1]);
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > maximumBoundary) {
    throw new SessionMessageCursorError();
  }
  return ordinal;
}

export function deduplicateNcpAgentSessionTailMessages(messages: readonly NcpMessage[]): NcpMessage[] {
  const byId = new Map<string, NcpMessage>();
  for (const message of messages) {
    byId.delete(message.id);
    byId.set(message.id, structuredClone(message));
  }
  return [...byId.values()];
}

export function isNcpAgentSessionMessageProjectionMeta(
  value: unknown,
  sessionId: string,
): value is NcpAgentSessionMessageProjectionMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const meta = value as Partial<NcpAgentSessionMessageProjectionMeta>;
  return (
    meta.version === NCP_AGENT_SESSION_MESSAGE_PROJECTION_VERSION &&
    meta.sessionId === sessionId &&
    Number.isSafeInteger(meta.total) &&
    Number.isSafeInteger(meta.projectedJournalOffset) &&
    Number.isSafeInteger(meta.dataBytes) &&
    (meta.activeMessageId === null || typeof meta.activeMessageId === "string") &&
    Array.isArray(meta.pendingCompactionMessageIds) &&
    meta.pendingCompactionMessageIds.every((id) => typeof id === "string") &&
    (meta.contextWindow === null || isRecord(meta.contextWindow))
  );
}

export function readActiveAssistantMessageId(
  messages: readonly NcpMessage[],
): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message?.role === "assistant" &&
      (message.status === "pending" || message.status === "streaming")
    ) {
      return message.id;
    }
  }
  return null;
}

export function readPendingCompactionMessageIds(
  messages: readonly NcpMessage[],
): string[] {
  const pending = new Set<string>();
  for (const message of messages) {
    if (readCompactionStatus(message) === "compressing") {
      pending.add(message.id);
    }
  }
  return [...pending];
}

export function mergePendingCompactionMessageIds(
  current: readonly string[],
  messages: readonly NcpMessage[],
): Set<string> {
  const pending = new Set(current);
  for (const message of messages) {
    const status = readCompactionStatus(message);
    if (status === "compressing") {
      pending.add(message.id);
    } else if (status) {
      pending.delete(message.id);
    }
  }
  return pending;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readCompactionStatus(message: NcpMessage): string | null {
  const checkpoint = message.metadata?.checkpoint;
  if (
    message.metadata?.nextclaw_timeline_kind !== "context_compaction" ||
    !isRecord(checkpoint)
  ) {
    return null;
  }
  return typeof checkpoint.status === "string" ? checkpoint.status : null;
}
