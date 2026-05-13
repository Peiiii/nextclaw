import { type NcpEndpointEvent, NcpEventType } from "@nextclaw/ncp";

const TEXT_DELTA_CHUNK_SIZE = 32;

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

export class ClaudeSdkEventMapperState {
  emittedText = "";
  textStarted = false;
  contentBlocks = new Map<number, ClaudeContentBlockState>();
  toolCalls = new Map<string, ClaudeToolCallState>();

  emitTextStartIfNeeded = (sessionId: string, messageId: string): NcpEndpointEvent[] => {
    if (this.textStarted) {
      return [];
    }
    this.textStarted = true;
    return [
      {
        type: NcpEventType.MessageTextStart,
        payload: {
          sessionId,
          messageId,
        },
      },
    ];
  };

  emitTextDelta = (sessionId: string, messageId: string, delta: string): NcpEndpointEvent[] => {
    if (!delta) {
      return [];
    }

    this.emittedText += delta;
    const events = this.emitTextStartIfNeeded(sessionId, messageId);
    for (const chunk of splitTextDelta(delta)) {
      events.push({
        type: NcpEventType.MessageTextDelta,
        payload: {
          sessionId,
          messageId,
          delta: chunk,
        },
      });
    }
    return events;
  };

  emitTextEnd = (sessionId: string, messageId: string): NcpEndpointEvent[] => {
    if (!this.textStarted) {
      return [];
    }
    this.textStarted = false;
    return [
      {
        type: NcpEventType.MessageTextEnd,
        payload: {
          sessionId,
          messageId,
        },
      },
    ];
  };

  ensureToolCallState = (toolCallId: string, toolName = "unknown"): ClaudeToolCallState => {
    const existing = this.toolCalls.get(toolCallId);
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
    this.toolCalls.set(toolCallId, nextState);
    return nextState;
  };

  emitToolCallStart = (
    sessionId: string,
    messageId: string,
    toolCallId: string,
    toolName: string,
  ): NcpEndpointEvent[] => {
    const toolState = this.ensureToolCallState(toolCallId, toolName);
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
  };

  emitToolCallArgs = (
    sessionId: string,
    toolCallId: string,
    args: string,
  ): NcpEndpointEvent[] => {
    const toolState = this.ensureToolCallState(toolCallId);
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
  };

  emitToolCallArgsDelta = (
    sessionId: string,
    messageId: string,
    toolCallId: string,
    delta: string,
  ): NcpEndpointEvent[] => {
    if (!delta) {
      return [];
    }
    const toolState = this.ensureToolCallState(toolCallId);
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
  };

  emitToolCallEnd = (sessionId: string, toolCallId: string): NcpEndpointEvent[] => {
    const toolState = this.ensureToolCallState(toolCallId);
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
  };

  emitToolCallResult = (
    sessionId: string,
    toolCallId: string,
    content: unknown,
  ): NcpEndpointEvent[] => {
    const toolState = this.ensureToolCallState(toolCallId);
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
  };
}

export function createClaudeSdkEventMapperState(): ClaudeSdkEventMapperState {
  return new ClaudeSdkEventMapperState();
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
  return state.emitTextStartIfNeeded(sessionId, messageId);
}

function splitTextDelta(delta: string): string[] {
  if (delta.length <= TEXT_DELTA_CHUNK_SIZE) {
    return delta ? [delta] : [];
  }
  const chunks: string[] = [];
  for (let index = 0; index < delta.length; index += TEXT_DELTA_CHUNK_SIZE) {
    chunks.push(delta.slice(index, index + TEXT_DELTA_CHUNK_SIZE));
  }
  return chunks;
}

export function emitTextDelta(
  sessionId: string,
  messageId: string,
  state: ClaudeSdkEventMapperState,
  delta: string,
): NcpEndpointEvent[] {
  return state.emitTextDelta(sessionId, messageId, delta);
}

export function emitTextEnd(
  sessionId: string,
  messageId: string,
  state: ClaudeSdkEventMapperState,
): NcpEndpointEvent[] {
  return state.emitTextEnd(sessionId, messageId);
}

export function ensureToolCallState(
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
  toolName = "unknown",
): ClaudeToolCallState {
  return state.ensureToolCallState(toolCallId, toolName);
}

export function emitToolCallStart(
  sessionId: string,
  messageId: string,
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
  toolName: string,
): NcpEndpointEvent[] {
  return state.emitToolCallStart(sessionId, messageId, toolCallId, toolName);
}

export function emitToolCallArgs(
  sessionId: string,
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
  args: string,
): NcpEndpointEvent[] {
  return state.emitToolCallArgs(sessionId, toolCallId, args);
}

export function emitToolCallArgsDelta(
  sessionId: string,
  messageId: string,
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
  delta: string,
): NcpEndpointEvent[] {
  return state.emitToolCallArgsDelta(sessionId, messageId, toolCallId, delta);
}

export function emitToolCallEnd(
  sessionId: string,
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
): NcpEndpointEvent[] {
  return state.emitToolCallEnd(sessionId, toolCallId);
}

export function emitToolCallResult(
  sessionId: string,
  state: ClaudeSdkEventMapperState,
  toolCallId: string,
  content: unknown,
): NcpEndpointEvent[] {
  return state.emitToolCallResult(sessionId, toolCallId, content);
}
