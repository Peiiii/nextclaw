import type { NcpMessage } from "@nextclaw/ncp";

export const SESSION_HISTORY_MESSAGE_TOOL_PAYLOAD_BUDGET_BYTES = 256 * 1024;
export const SESSION_HISTORY_PAGE_TOOL_PAYLOAD_BUDGET_BYTES = 2 * 1024 * 1024;
export const SESSION_HISTORY_MESSAGE_TOOL_CALL_BUDGET = 12;
export const SESSION_HISTORY_PAGE_TOOL_CALL_BUDGET = 80;
export const SESSION_HISTORY_COMPACT_MESSAGE_BUDGET_BYTES = 24 * 1024;
export const SESSION_HISTORY_COMPACT_MIN_MESSAGES = 5;
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

export type CompactSessionMessageHistoryPayloadView = SessionMessageHistoryPayloadView & {
  startIndex: number;
};

type MessageToolPayloadCandidate = {
  message: NcpMessage;
  bytes: number;
  toolCalls: number;
};

function serializePayload(value: unknown): string {
  if (value === undefined) return "";
  try {
    return typeof value === "string" ? value : JSON.stringify(value) ?? "";
  } catch {
    return String(value);
  }
}

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(serializePayload(value), "utf8");
}

function toolPayloadCost(message: NcpMessage): { bytes: number; toolCalls: number } {
  let bytes = 0;
  let toolCalls = 0;
  for (const part of message.parts) {
    if (part.type !== "tool-invocation") continue;
    toolCalls += 1;
    bytes += Buffer.byteLength(serializePayload(part.args), "utf8");
    bytes += Buffer.byteLength(serializePayload(part.result), "utf8");
  }
  return { bytes, toolCalls };
}

function isDeferrableMessage(message: NcpMessage): boolean {
  return (
    message.role === "assistant" &&
    (message.status === "final" || message.status === "error")
  );
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
  messageToolCallBudget?: number;
  pageToolCallBudget?: number;
}): SessionMessageHistoryPayloadView {
  const {
    messageBudgetBytes: requestedMessageBudgetBytes,
    messageDetailCursors,
    messages,
    messageToolCallBudget: requestedMessageToolCallBudget,
    pageBudgetBytes: requestedPageBudgetBytes,
    pageToolCallBudget: requestedPageToolCallBudget,
  } = params;
  const messageBudgetBytes =
    requestedMessageBudgetBytes ?? SESSION_HISTORY_MESSAGE_TOOL_PAYLOAD_BUDGET_BYTES;
  const pageBudgetBytes =
    requestedPageBudgetBytes ?? SESSION_HISTORY_PAGE_TOOL_PAYLOAD_BUDGET_BYTES;
  const messageToolCallBudget =
    requestedMessageToolCallBudget ?? SESSION_HISTORY_MESSAGE_TOOL_CALL_BUDGET;
  const pageToolCallBudget =
    requestedPageToolCallBudget ?? SESSION_HISTORY_PAGE_TOOL_CALL_BUDGET;
  const candidates: MessageToolPayloadCandidate[] = messages
    .filter((message) => isDeferrableMessage(message) && Boolean(messageDetailCursors[message.id]))
    .map((message) => ({ message, ...toolPayloadCost(message) }))
    .filter((candidate) => candidate.toolCalls > 0);
  const deferredIds = new Set(
    candidates
      .filter(
        (candidate) =>
          candidate.bytes > messageBudgetBytes ||
          candidate.toolCalls > messageToolCallBudget,
      )
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
  let eagerPageToolCalls = candidates.reduce(
    (total, candidate) => total + (deferredIds.has(candidate.message.id) ? 0 : candidate.toolCalls),
    0,
  );
  if (eagerPageToolCalls > pageToolCallBudget) {
    const remaining = candidates
      .filter((candidate) => !deferredIds.has(candidate.message.id))
      .sort((left, right) => right.toolCalls - left.toolCalls || right.bytes - left.bytes);
    for (const candidate of remaining) {
      if (eagerPageToolCalls <= pageToolCallBudget) break;
      deferredIds.add(candidate.message.id);
      eagerPageToolCalls -= candidate.toolCalls;
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

export function compactSessionMessageHistoryPayloadView(params: {
  view: SessionMessageHistoryPayloadView;
  budgetBytes?: number;
  minimumMessages?: number;
}): CompactSessionMessageHistoryPayloadView {
  const { view } = params;
  const budgetBytes = params.budgetBytes ?? SESSION_HISTORY_COMPACT_MESSAGE_BUDGET_BYTES;
  const minimumMessages = Math.max(
    1,
    Math.trunc(params.minimumMessages ?? SESSION_HISTORY_COMPACT_MIN_MESSAGES),
  );
  let startIndex = Math.max(0, view.messages.length - minimumMessages);
  let bytes = view.messages
    .slice(startIndex)
    .reduce((total, message) => total + serializedBytes(message), 0);
  while (startIndex > 0) {
    const previousBytes = serializedBytes(view.messages[startIndex - 1]);
    if (bytes + previousBytes > budgetBytes) break;
    startIndex -= 1;
    bytes += previousBytes;
  }
  const messages = view.messages.slice(startIndex);
  const visibleIds = new Set(messages.map((message) => message.id));
  return {
    messages,
    deferredToolPayloads: Object.fromEntries(
      Object.entries(view.deferredToolPayloads).filter(([messageId]) => visibleIds.has(messageId)),
    ),
    startIndex,
  };
}
