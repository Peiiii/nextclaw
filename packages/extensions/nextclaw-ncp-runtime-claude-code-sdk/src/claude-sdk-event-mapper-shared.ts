import { type NcpEndpointEvent, NcpEventType } from "@nextclaw/ncp";

type ClaudeContentBlockKind = "text" | "reasoning" | "tool";

type ClaudeContentBlockState = {
  kind: ClaudeContentBlockKind;
  toolCallId?: string;
};

type ClaudeToolCallState = {
  toolName: string;
  args: string;
  started: boolean;
  ended: boolean;
  resultEmitted: boolean;
};

export type ClaudeSdkEventMapperState = {
  emittedText: string;
  textStarted: boolean;
  contentBlocks: Map<number, ClaudeContentBlockState>;
  toolCalls: Map<string, ClaudeToolCallState>;
};

export function createClaudeSdkEventMapperState(): ClaudeSdkEventMapperState {
  return {
    emittedText: "",
    textStarted: false,
    contentBlocks: new Map(),
    toolCalls: new Map(),
  };
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function readIndex(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export function stringifyToolArgs(args: unknown): string {
  try {
    return JSON.stringify(args ?? {});
  } catch {
    return JSON.stringify({
      __serialization_error__: "tool arguments are not JSON serializable",
    });
  }
}

export function readThinkingText(record: Record<string, unknown> | undefined): string {
  if (!record) {
    return "";
  }
  const thinking = readString(record.thinking);
  if (thinking) {
    return thinking;
  }
  const text = readString(record.text);
  if (text) {
    return text;
  }
  return "";
}

export function emitTextStartIfNeeded(
  sessionId: string,
  messageId: string,
  state: ClaudeSdkEventMapperState,
): NcpEndpointEvent[] {
  if (state.textStarted) {
    return [];
  }
  state.textStarted = true;
  return [
    {
      type: NcpEventType.MessageTextStart,
      payload: {
        sessionId,
        messageId,
      },
    },
  ];
}

export function emitTextDelta(
  sessionId: string,
  messageId: string,
  state: ClaudeSdkEventMapperState,
  delta: string,
): NcpEndpointEvent[] {
  if (!delta) {
    return [];
  }

  state.emittedText += delta;
  return [
    ...emitTextStartIfNeeded(sessionId, messageId, state),
    {
      type: NcpEventType.MessageTextDelta,
      payload: {
        sessionId,
        messageId,
        delta,
      },
    },
  ];
}

export function emitTextEnd(
  sessionId: string,
  messageId: string,
  state: ClaudeSdkEventMapperState,
): NcpEndpointEvent[] {
  if (!state.textStarted) {
    return [];
  }
  state.textStarted = false;
  return [
    {
      type: NcpEventType.MessageTextEnd,
      payload: {
        sessionId,
        messageId,
      },
    },
  ];
}

export function ensureToolCallState(
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
  toolName = "unknown",
): ClaudeToolCallState {
  const existing = state.toolCalls.get(toolCallId);
  if (existing) {
    if (existing.toolName === "unknown" && toolName !== "unknown") {
      existing.toolName = toolName;
    }
    return existing;
  }

  const nextState: ClaudeToolCallState = {
    toolName,
    args: "",
    started: false,
    ended: false,
    resultEmitted: false,
  };
  state.toolCalls.set(toolCallId, nextState);
  return nextState;
}

export function emitToolCallStart(
  sessionId: string,
  messageId: string,
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
  toolName: string,
): NcpEndpointEvent[] {
  const toolState = ensureToolCallState(state, toolCallId, toolName);
  if (toolState.started) {
    return [];
  }
  toolState.started = true;
  toolState.toolName = toolName || toolState.toolName || "unknown";
  return [
    {
      type: NcpEventType.MessageToolCallStart,
      payload: {
        sessionId,
        messageId,
        toolCallId,
        toolName: toolState.toolName,
      },
    },
  ];
}

export function emitToolCallArgs(
  sessionId: string,
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
  args: string,
): NcpEndpointEvent[] {
  const toolState = ensureToolCallState(state, toolCallId);
  if (toolState.args === args) {
    return [];
  }
  toolState.args = args;
  return [
    {
      type: NcpEventType.MessageToolCallArgs,
      payload: {
        sessionId,
        toolCallId,
        args,
      },
    },
  ];
}

export function emitToolCallArgsDelta(
  sessionId: string,
  messageId: string,
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
  delta: string,
): NcpEndpointEvent[] {
  if (!delta) {
    return [];
  }
  const toolState = ensureToolCallState(state, toolCallId);
  toolState.args = `${toolState.args}${delta}`;
  return [
    {
      type: NcpEventType.MessageToolCallArgsDelta,
      payload: {
        sessionId,
        messageId,
        toolCallId,
        delta,
      },
    },
  ];
}

export function emitToolCallEnd(
  sessionId: string,
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
): NcpEndpointEvent[] {
  const toolState = ensureToolCallState(state, toolCallId);
  if (toolState.ended) {
    return [];
  }
  toolState.ended = true;
  return [
    {
      type: NcpEventType.MessageToolCallEnd,
      payload: {
        sessionId,
        toolCallId,
      },
    },
  ];
}

export function emitToolCallResult(
  sessionId: string,
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
  content: unknown,
): NcpEndpointEvent[] {
  const toolState = ensureToolCallState(state, toolCallId);
  if (toolState.resultEmitted) {
    return [];
  }
  toolState.resultEmitted = true;
  return [
    {
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId,
        toolCallId,
        content,
      },
    },
  ];
}
