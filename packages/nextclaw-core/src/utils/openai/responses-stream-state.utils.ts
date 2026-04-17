import type { LLMResponse, LLMStreamEvent, ToolCallRequest } from "../../providers/base.js";

type OpenAiResponsesToolCallBuffer = {
  index: number;
  itemId: string;
  callId?: string;
  name?: string;
  argumentsText: string;
};

export type OpenAiResponsesStreamState = {
  contentParts: string[];
  reasoningParts: string[];
  toolCallBuffers: Map<string, OpenAiResponsesToolCallBuffer>;
  responsePayload: Record<string, unknown> | null;
};

export function createOpenAiResponsesStreamState(): OpenAiResponsesStreamState {
  return {
    contentParts: [],
    reasoningParts: [],
    toolCallBuffers: new Map(),
    responsePayload: null,
  };
}

export function consumeOpenAiResponsesEvent(params: {
  payload: Record<string, unknown>;
  state: OpenAiResponsesStreamState;
}): LLMStreamEvent[] {
  const responseRecord = readRecord(params.payload.response);
  if (responseRecord && Array.isArray(responseRecord.output)) {
    params.state.responsePayload = responseRecord;
  }

  const textEvent = consumeTextDelta(params);
  if (textEvent) {
    return [textEvent];
  }

  const reasoningEvent = consumeReasoningDelta(params);
  if (reasoningEvent) {
    return [reasoningEvent];
  }

  if (consumeOutputItem(params)) {
    return [];
  }

  const toolCallEvent = consumeFunctionCallArguments(params);
  if (toolCallEvent) {
    return [toolCallEvent];
  }

  const errorMessage = readStreamErrorMessage(params.payload);
  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return [];
}

export function buildFallbackResponse(params: {
  state: OpenAiResponsesStreamState;
  parseToolCallArguments: (raw: unknown) => Record<string, unknown>;
}): LLMResponse {
  return {
    content: params.state.contentParts.join("") || null,
    toolCalls: finalizeToolCalls(params),
    finishReason: "completed",
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
    reasoningContent: params.state.reasoningParts.join("").trim() || null,
  };
}

function consumeTextDelta(params: {
  payload: Record<string, unknown>;
  state: OpenAiResponsesStreamState;
}): LLMStreamEvent | null {
  if (params.payload.type !== "response.output_text.delta" || typeof params.payload.delta !== "string" || !params.payload.delta) {
    return null;
  }
  params.state.contentParts.push(params.payload.delta);
  return {
    type: "delta",
    delta: params.payload.delta,
  };
}

function consumeReasoningDelta(params: {
  payload: Record<string, unknown>;
  state: OpenAiResponsesStreamState;
}): LLMStreamEvent | null {
  if (params.payload.type !== "response.reasoning_text.delta" || typeof params.payload.delta !== "string" || !params.payload.delta) {
    return null;
  }
  params.state.reasoningParts.push(params.payload.delta);
  return {
    type: "reasoning_delta",
    delta: params.payload.delta,
  };
}

function consumeOutputItem(params: {
  payload: Record<string, unknown>;
  state: OpenAiResponsesStreamState;
}): boolean {
  if (params.payload.type !== "response.output_item.added" && params.payload.type !== "response.output_item.done") {
    return false;
  }

  const item = readRecord(params.payload.item);
  const outputIndex = typeof params.payload.output_index === "number"
    ? params.payload.output_index
    : params.state.toolCallBuffers.size;
  if (item) {
    updateToolCallBufferFromItem({
      state: params.state,
      item,
      outputIndex,
    });
  }
  return true;
}

function consumeFunctionCallArguments(params: {
  payload: Record<string, unknown>;
  state: OpenAiResponsesStreamState;
}): LLMStreamEvent | null {
  if (params.payload.type !== "response.function_call_arguments.delta" || typeof params.payload.delta !== "string") {
    return null;
  }

  const itemId = typeof params.payload.item_id === "string" && params.payload.item_id.trim()
    ? params.payload.item_id
    : `tool-${params.state.toolCallBuffers.size}`;
  const outputIndex = typeof params.payload.output_index === "number"
    ? params.payload.output_index
    : params.state.toolCallBuffers.size;
  const buffer = ensureToolCallBuffer({
    state: params.state,
    itemId,
    index: outputIndex,
  });
  buffer.argumentsText += params.payload.delta;

  return {
    type: "tool_call_delta",
    toolCalls: [
      {
        index: buffer.index,
        id: buffer.callId ?? buffer.itemId,
        type: "function",
        function: {
          ...(buffer.name ? { name: buffer.name } : {}),
          arguments: params.payload.delta,
        },
      },
    ],
  };
}

function readStreamErrorMessage(payload: Record<string, unknown>): string | null {
  const payloadError = readRecord(payload.error);
  if (
    payload.type !== "error" &&
    payload.type !== "response.failed" &&
    !(payloadError && typeof payloadError.message === "string" && payloadError.message.trim())
  ) {
    return null;
  }

  if (payloadError && typeof payloadError.message === "string" && payloadError.message.trim()) {
    return payloadError.message;
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }
  return "Responses stream failed.";
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function ensureToolCallBuffer(params: {
  state: OpenAiResponsesStreamState;
  itemId: string;
  index: number;
}): OpenAiResponsesToolCallBuffer {
  const existing = params.state.toolCallBuffers.get(params.itemId);
  if (existing) {
    return existing;
  }
  const created: OpenAiResponsesToolCallBuffer = {
    index: params.index,
    itemId: params.itemId,
    argumentsText: "",
  };
  params.state.toolCallBuffers.set(params.itemId, created);
  return created;
}

function updateToolCallBufferFromItem(params: {
  state: OpenAiResponsesStreamState;
  item: Record<string, unknown>;
  outputIndex: number;
}): void {
  const type = typeof params.item.type === "string" ? params.item.type : "";
  if (type !== "function_call" && type !== "tool_call") {
    return;
  }

  const itemId = typeof params.item.id === "string" && params.item.id.trim()
    ? params.item.id
    : `tool-${params.outputIndex}`;
  const buffer = ensureToolCallBuffer({
    state: params.state,
    itemId,
    index: params.outputIndex,
  });

  if (typeof params.item.call_id === "string" && params.item.call_id.trim()) {
    buffer.callId = params.item.call_id;
  }
  if (typeof params.item.name === "string" && params.item.name.trim()) {
    buffer.name = params.item.name;
  }

  const itemFunction = readRecord(params.item.function);
  if (itemFunction) {
    if (typeof itemFunction.name === "string" && itemFunction.name.trim()) {
      buffer.name = itemFunction.name;
    }
    if (typeof itemFunction.arguments === "string") {
      buffer.argumentsText = itemFunction.arguments;
    }
  }

  if (typeof params.item.arguments === "string") {
    buffer.argumentsText = params.item.arguments;
  }
}

function finalizeToolCalls(params: {
  state: OpenAiResponsesStreamState;
  parseToolCallArguments: (raw: unknown) => Record<string, unknown>;
}): ToolCallRequest[] {
  return Array.from(params.state.toolCallBuffers.values())
    .sort((left, right) => left.index - right.index)
    .filter((entry) => typeof entry.name === "string" && entry.name.trim().length > 0)
    .map((entry, index) => ({
      id: entry.callId ?? entry.itemId ?? `tool-${index}`,
      name: entry.name!.trim(),
      arguments: params.parseToolCallArguments(entry.argumentsText),
    }));
}
