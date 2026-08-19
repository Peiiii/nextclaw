import type { NcpMessage } from "@nextclaw/ncp";

export const SESSION_HISTORY_MESSAGE_TOOL_PAYLOAD_BUDGET_BYTES = 256 * 1024;
export const SESSION_HISTORY_PAGE_TOOL_PAYLOAD_BUDGET_BYTES = 2 * 1024 * 1024;
export const SESSION_HISTORY_TOOL_PAYLOAD_SUMMARY_METADATA_KEY =
  "nextclawUiHistoryToolPayloadSummary";

const SUMMARY_TOOL_NAME_LIMIT = 3;

export type DeferredSessionMessageToolPayload = {
  cursor: string;
};

export type SessionMessageHistoryPayloadView = {
  messages: NcpMessage[];
  deferredToolPayloads: Record<string, DeferredSessionMessageToolPayload>;
};

type MessageToolPayloadCandidate = {
  message: NcpMessage;
  bytes: number;
};

function serializePayload(value: unknown): string {
  if (value === undefined) return "";
  try {
    return typeof value === "string" ? value : JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

function toolPayloadBytes(message: NcpMessage): number {
  let bytes = 0;
  for (const part of message.parts) {
    if (part.type !== "tool-invocation") continue;
    bytes += Buffer.byteLength(serializePayload(part.args), "utf8");
    bytes += Buffer.byteLength(serializePayload(part.result), "utf8");
  }
  return bytes;
}

function isDeferrableMessage(message: NcpMessage): boolean {
  return message.role === "assistant" && message.status === "final";
}

function deferMessageToolPayload(message: NcpMessage): NcpMessage {
  const tools = message.parts.filter((part) => part.type === "tool-invocation");
  const toolNames = [...new Set(tools.map((part) => part.toolName.trim()).filter(Boolean))]
    .slice(0, SUMMARY_TOOL_NAME_LIMIT);
  const parts: NcpMessage["parts"] = [];
  let keptRepresentative = false;
  for (const part of message.parts) {
    if (part.type !== "tool-invocation") {
      parts.push(part);
      continue;
    }
    if (keptRepresentative) continue;
    keptRepresentative = true;
    parts.push({ ...part, args: undefined, result: undefined });
  }
  return {
    ...message,
    metadata: {
      ...(message.metadata ?? {}),
      [SESSION_HISTORY_TOOL_PAYLOAD_SUMMARY_METADATA_KEY]: {
        toolCallCount: tools.length,
        toolNames,
      },
    },
    parts,
  };
}

export function buildSessionMessageHistoryPayloadView(params: {
  messages: readonly NcpMessage[];
  messageDetailCursors: Readonly<Record<string, string>>;
  messageBudgetBytes?: number;
  pageBudgetBytes?: number;
}): SessionMessageHistoryPayloadView {
  const { messageDetailCursors, messages } = params;
  const messageBudgetBytes =
    params.messageBudgetBytes ?? SESSION_HISTORY_MESSAGE_TOOL_PAYLOAD_BUDGET_BYTES;
  const pageBudgetBytes =
    params.pageBudgetBytes ?? SESSION_HISTORY_PAGE_TOOL_PAYLOAD_BUDGET_BYTES;
  const candidates: MessageToolPayloadCandidate[] = messages
    .filter((message) => isDeferrableMessage(message) && Boolean(messageDetailCursors[message.id]))
    .map((message) => ({ message, bytes: toolPayloadBytes(message) }))
    .filter((candidate) => candidate.bytes > 0);
  const deferredIds = new Set(
    candidates
      .filter((candidate) => candidate.bytes > messageBudgetBytes)
      .map((candidate) => candidate.message.id),
  );
  let eagerPageBytes = candidates.reduce(
    (total, candidate) => total + (deferredIds.has(candidate.message.id) ? 0 : candidate.bytes),
    0,
  );
  if (eagerPageBytes > pageBudgetBytes) {
    const remaining = candidates
      .filter((candidate) => !deferredIds.has(candidate.message.id))
      .sort((left, right) => right.bytes - left.bytes);
    for (const candidate of remaining) {
      if (eagerPageBytes <= pageBudgetBytes) break;
      deferredIds.add(candidate.message.id);
      eagerPageBytes -= candidate.bytes;
    }
  }
  const deferredToolPayloads = Object.fromEntries(
    [...deferredIds].map((messageId) => [
      messageId,
      { cursor: messageDetailCursors[messageId]! },
    ]),
  );
  return {
    messages: messages.map((message) =>
      deferredIds.has(message.id) ? deferMessageToolPayload(message) : message,
    ),
    deferredToolPayloads,
  };
}
