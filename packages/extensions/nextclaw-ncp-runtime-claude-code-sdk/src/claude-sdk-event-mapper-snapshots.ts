import { type NcpEndpointEvent } from "@nextclaw/ncp";
import type { ClaudeCodeMessage } from "./claude-code-sdk-types.js";
import {
  emitTextDelta,
  emitToolCallArgs,
  emitToolCallEnd,
  emitToolCallResult,
  emitToolCallStart,
  readArray,
  readRecord,
  readString,
  stringifyToolArgs,
  type ClaudeSdkEventMapperState,
} from "./claude-sdk-event-mapper-shared.js";

type ClaudeToolCallSnapshot = {
  id: string;
  name: string;
  args: string;
};

type ClaudeToolResultSnapshot = {
  toolCallId: string;
  content: unknown;
};

function extractAssistantSnapshotText(message: ClaudeCodeMessage): string {
  if (message.type === "result" && typeof message.result === "string") {
    return message.result.trim();
  }

  if (message.type !== "assistant") {
    return "";
  }

  return readArray(message.message?.content)
    .map((entry) => {
      const record = readRecord(entry);
      if (!record || readString(record.type) !== "text") {
        return "";
      }
      return readString(record.text) ?? readString(record.content) ?? "";
    })
    .join("");
}

function extractAssistantSnapshotToolCalls(message: ClaudeCodeMessage): ClaudeToolCallSnapshot[] {
  if (message.type !== "assistant") {
    return [];
  }

  return readArray(message.message?.content)
    .map((entry) => {
      const record = readRecord(entry);
      if (!record || readString(record.type) !== "tool_use") {
        return null;
      }
      const id = readString(record.id);
      const name = readString(record.name);
      if (!id || !name) {
        return null;
      }
      return {
        id,
        name,
        args: stringifyToolArgs(readRecord(record.input) ?? {}),
      } satisfies ClaudeToolCallSnapshot;
    })
    .filter((entry): entry is ClaudeToolCallSnapshot => entry !== null);
}

function extractUserToolResults(message: ClaudeCodeMessage): ClaudeToolResultSnapshot[] {
  if (message.type !== "user") {
    return [];
  }

  const results: ClaudeToolResultSnapshot[] = [];
  const directToolCallId =
    readString((message as { tool_use_id?: unknown }).tool_use_id) ?? message.parent_tool_use_id ?? undefined;
  if (directToolCallId && "tool_use_result" in message) {
    results.push({
      toolCallId: directToolCallId,
      content: message.tool_use_result,
    });
  }

  for (const entry of readArray(message.message?.content)) {
    const record = readRecord(entry);
    if (!record || readString(record.type) !== "tool_result") {
      continue;
    }
    const toolCallId = readString(record.tool_use_id);
    if (!toolCallId) {
      continue;
    }
    results.push({
      toolCallId,
      content: record.content,
    });
  }

  return results;
}

export function mapClaudeAssistantSnapshotMessage(params: {
  sessionId: string;
  messageId: string;
  message: ClaudeCodeMessage;
  state: ClaudeSdkEventMapperState;
}): NcpEndpointEvent[] {
  const { sessionId, messageId, message, state } = params;
  const events: NcpEndpointEvent[] = [];

  const snapshotText = extractAssistantSnapshotText(message);
  if (snapshotText.length > state.emittedText.length) {
    events.push(...emitTextDelta(sessionId, messageId, state, snapshotText.slice(state.emittedText.length)));
  }

  for (const toolCall of extractAssistantSnapshotToolCalls(message)) {
    events.push(...emitToolCallStart(sessionId, messageId, state, toolCall.id, toolCall.name));
    if (toolCall.args !== "{}") {
      events.push(...emitToolCallArgs(sessionId, state, toolCall.id, toolCall.args));
    }
    events.push(...emitToolCallEnd(sessionId, state, toolCall.id));
  }

  return events;
}

export function mapClaudeUserToolResultMessage(params: {
  sessionId: string;
  messageId: string;
  message: ClaudeCodeMessage;
  state: ClaudeSdkEventMapperState;
}): NcpEndpointEvent[] {
  const { sessionId, messageId, message, state } = params;
  const events: NcpEndpointEvent[] = [];

  for (const result of extractUserToolResults(message)) {
    events.push(...emitToolCallStart(sessionId, messageId, state, result.toolCallId, "unknown"));
    events.push(...emitToolCallEnd(sessionId, state, result.toolCallId));
    events.push(...emitToolCallResult(sessionId, state, result.toolCallId, result.content));
  }

  return events;
}

export function mapClaudeToolProgressMessage(params: {
  sessionId: string;
  messageId: string;
  message: ClaudeCodeMessage;
  state: ClaudeSdkEventMapperState;
}): NcpEndpointEvent[] {
  const { sessionId, messageId, message, state } = params;
  if (message.type !== "tool_progress") {
    return [];
  }

  const toolCallId = readString(message.tool_use_id);
  const toolName = readString(message.tool_name) ?? "unknown";
  if (!toolCallId) {
    return [];
  }

  return emitToolCallStart(sessionId, messageId, state, toolCallId, toolName);
}
