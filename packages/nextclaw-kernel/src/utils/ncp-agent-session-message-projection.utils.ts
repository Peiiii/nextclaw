import type { NcpMessage } from "@nextclaw/ncp";
import { SessionMessageCursorError } from "@kernel/types/session.types.js";

const OFFSET_FIELD_WIDTH = 20;

export const MESSAGE_PROJECTION_OFFSET_RECORD_BYTES = OFFSET_FIELD_WIDTH * 2 + 2;

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
