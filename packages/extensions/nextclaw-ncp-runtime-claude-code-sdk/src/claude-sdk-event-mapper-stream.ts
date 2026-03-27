import { type NcpEndpointEvent, NcpEventType } from "@nextclaw/ncp";
import type { ClaudeCodeMessage } from "./claude-code-sdk-types.js";
import {
  emitTextDelta,
  emitTextEnd,
  emitTextStartIfNeeded,
  emitToolCallArgs,
  emitToolCallArgsDelta,
  emitToolCallEnd,
  emitToolCallStart,
  readIndex,
  readRecord,
  readString,
  readThinkingText,
  stringifyToolArgs,
  type ClaudeSdkEventMapperState,
} from "./claude-sdk-event-mapper-shared.js";

function emitReasoningStart(sessionId: string, messageId: string): NcpEndpointEvent {
  return {
    type: NcpEventType.MessageReasoningStart,
    payload: {
      sessionId,
      messageId,
    },
  };
}

function emitReasoningEnd(sessionId: string, messageId: string): NcpEndpointEvent {
  return {
    type: NcpEventType.MessageReasoningEnd,
    payload: {
      sessionId,
      messageId,
    },
  };
}

function handleStreamEventContentBlockStart(params: {
  sessionId: string;
  messageId: string;
  state: ClaudeSdkEventMapperState;
  index: number;
  contentBlock: Record<string, unknown> | undefined;
}): NcpEndpointEvent[] {
  const { sessionId, messageId, state, index, contentBlock } = params;
  const events: NcpEndpointEvent[] = [];
  const blockType = readString(contentBlock?.type) ?? "text";

  if (blockType === "tool_use") {
    const toolCallId = readString(contentBlock?.id) ?? `tool-${index}`;
    const toolName = readString(contentBlock?.name) ?? "unknown";
    state.contentBlocks.set(index, {
      kind: "tool",
      toolCallId,
    });
    events.push(...emitToolCallStart(sessionId, messageId, state, toolCallId, toolName));

    const initialArgs = stringifyToolArgs(readRecord(contentBlock?.input) ?? {});
    if (initialArgs !== "{}") {
      events.push(...emitToolCallArgs(sessionId, state, toolCallId, initialArgs));
    }
    return events;
  }

  if (blockType === "thinking" || blockType === "redacted_thinking") {
    state.contentBlocks.set(index, { kind: "reasoning" });
    return [emitReasoningStart(sessionId, messageId)];
  }

  state.contentBlocks.set(index, { kind: "text" });
  return emitTextStartIfNeeded(sessionId, messageId, state);
}

function handleStreamEventContentBlockDelta(params: {
  sessionId: string;
  messageId: string;
  state: ClaudeSdkEventMapperState;
  index: number;
  delta: Record<string, unknown> | undefined;
}): NcpEndpointEvent[] {
  const { sessionId, messageId, state, index, delta } = params;
  const blockState = state.contentBlocks.get(index);
  const deltaType = readString(delta?.type);
  const events: NcpEndpointEvent[] = [];

  if (deltaType === "input_json_delta") {
    const toolCallId = blockState?.toolCallId;
    const partialJson = readString(delta?.partial_json) ?? "";
    if (!toolCallId) {
      return events;
    }
    events.push(...emitToolCallStart(sessionId, messageId, state, toolCallId, "unknown"));
    events.push(...emitToolCallArgsDelta(sessionId, messageId, state, toolCallId, partialJson));
    return events;
  }

  if (deltaType === "thinking_delta") {
    const thinkingText = readThinkingText(delta);
    if (!blockState) {
      state.contentBlocks.set(index, { kind: "reasoning" });
      events.push(emitReasoningStart(sessionId, messageId));
    }
    if (thinkingText) {
      events.push({
        type: NcpEventType.MessageReasoningDelta,
        payload: {
          sessionId,
          messageId,
          delta: thinkingText,
        },
      });
    }
    return events;
  }

  const textDelta = readString(delta?.text);
  if (deltaType === "text_delta" && textDelta) {
    if (!blockState) {
      state.contentBlocks.set(index, { kind: "text" });
    }
    events.push(...emitTextDelta(sessionId, messageId, state, textDelta));
  }

  return events;
}

function handleStreamEventContentBlockStop(params: {
  sessionId: string;
  messageId: string;
  state: ClaudeSdkEventMapperState;
  index: number;
}): NcpEndpointEvent[] {
  const { sessionId, messageId, state, index } = params;
  const blockState = state.contentBlocks.get(index);
  if (!blockState) {
    return [];
  }
  state.contentBlocks.delete(index);

  if (blockState.kind === "tool" && blockState.toolCallId) {
    return emitToolCallEnd(sessionId, state, blockState.toolCallId);
  }
  if (blockState.kind === "reasoning") {
    return [emitReasoningEnd(sessionId, messageId)];
  }

  return emitTextEnd(sessionId, messageId, state);
}

export function flushClaudeSdkMessageEventState(params: {
  sessionId: string;
  messageId: string;
  state: ClaudeSdkEventMapperState;
}): NcpEndpointEvent[] {
  const { sessionId, messageId, state } = params;
  const events: NcpEndpointEvent[] = [];

  const sortedIndexes = [...state.contentBlocks.keys()].sort((left, right) => left - right);
  for (const index of sortedIndexes) {
    const blockState = state.contentBlocks.get(index);
    if (!blockState) {
      continue;
    }
    if (blockState.kind === "tool" && blockState.toolCallId) {
      events.push(...emitToolCallEnd(sessionId, state, blockState.toolCallId));
      continue;
    }
    if (blockState.kind === "reasoning") {
      events.push(emitReasoningEnd(sessionId, messageId));
      continue;
    }
    events.push(...emitTextEnd(sessionId, messageId, state));
  }

  state.contentBlocks.clear();
  return events;
}

export function mapClaudeStreamEventMessage(params: {
  sessionId: string;
  messageId: string;
  message: ClaudeCodeMessage;
  state: ClaudeSdkEventMapperState;
}): NcpEndpointEvent[] {
  const { sessionId, messageId, message, state } = params;
  if (message.type !== "stream_event") {
    return [];
  }

  const event = readRecord(message.event);
  const eventType = readString(event?.type);
  if (!eventType) {
    return [];
  }

  const index = readIndex(event?.index);
  if (eventType === "content_block_start" && index !== null) {
    return handleStreamEventContentBlockStart({
      sessionId,
      messageId,
      state,
      index,
      contentBlock: readRecord(event?.content_block),
    });
  }
  if (eventType === "content_block_delta" && index !== null) {
    return handleStreamEventContentBlockDelta({
      sessionId,
      messageId,
      state,
      index,
      delta: readRecord(event?.delta),
    });
  }
  if (eventType === "content_block_stop" && index !== null) {
    return handleStreamEventContentBlockStop({
      sessionId,
      messageId,
      state,
      index,
    });
  }
  if (eventType === "message_stop") {
    return flushClaudeSdkMessageEventState({
      sessionId,
      messageId,
      state,
    });
  }

  return [];
}
