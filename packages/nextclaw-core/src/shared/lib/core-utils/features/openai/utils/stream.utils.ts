import type { LLMResponse, LLMStreamEvent, ToolCallRequest } from "@core/features/llm-providers/index.js";
import { normalizeStructuredUsageCounters } from "@core/features/llm-providers/index.js";
import { executeOpenAiStreamRequest, readOpenAiSsePayloads } from "./sse-stream.utils.js";

type ToolCallBuffer = {
  id?: string;
  name?: string;
  argumentsText: string;
};

type StreamChunkChoice = {
  delta?: Record<string, unknown>;
  finish_reason?: string | null;
};

type StreamChunk = {
  choices?: StreamChunkChoice[];
  usage?: Record<string, unknown>;
};

export type OpenAiChatCompletionsStreamState = {
  contentParts: string[];
  reasoningParts: string[];
  toolCallBuffers: Map<number, ToolCallBuffer>;
  finishReason: string;
  sawFinishReason: boolean;
  usage: Record<string, number>;
};

export function createOpenAiChatCompletionsStreamState(): OpenAiChatCompletionsStreamState {
  return {
    contentParts: [],
    reasoningParts: [],
    toolCallBuffers: new Map<number, ToolCallBuffer>(),
    finishReason: "stop",
    sawFinishReason: false,
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    }
  };
}

function readFirstChoice(chunk: StreamChunk): StreamChunkChoice | null {
  return chunk.choices?.[0] ?? null;
}

function updateUsage(
  state: OpenAiChatCompletionsStreamState,
  usage: Record<string, unknown> | undefined,
  mergeUsageCounters: (
    current: Record<string, number>,
    incoming: Record<string, unknown>
  ) => Record<string, number>,
): void {
  if (!usage) {
    return;
  }
  state.usage = mergeUsageCounters(state.usage, usage);
}

function appendReasoningDelta(
  state: OpenAiChatCompletionsStreamState,
  delta: Record<string, unknown>,
  events: LLMStreamEvent[],
): void {
  const reasoningDelta =
    (delta as { reasoning_content?: string } | undefined)?.reasoning_content ??
    (delta as { reasoning?: string } | undefined)?.reasoning;
  if (typeof reasoningDelta !== "string" || !reasoningDelta) {
    return;
  }
  state.reasoningParts.push(reasoningDelta);
  events.push({
    type: "reasoning_delta",
    delta: reasoningDelta,
  });
}

function appendTextDelta(
  state: OpenAiChatCompletionsStreamState,
  delta: Record<string, unknown>,
  events: LLMStreamEvent[],
): void {
  if (typeof delta.content !== "string" || delta.content.length === 0) {
    return;
  }
  state.contentParts.push(delta.content);
  events.push({
    type: "delta",
    delta: delta.content
  });
}

function appendToolCallBuffer(
  buffer: ToolCallBuffer,
  toolDelta: Record<string, unknown>,
): ToolCallBuffer {
  const next = { ...buffer };
  if (typeof toolDelta.id === "string" && toolDelta.id.trim()) {
    next.id = toolDelta.id;
  }
  const fn = toolDelta.function;
  if (fn && typeof fn === "object" && !Array.isArray(fn)) {
    const maybeName = (fn as { name?: unknown }).name;
    const maybeArgs = (fn as { arguments?: unknown }).arguments;
    if (typeof maybeName === "string" && maybeName.trim()) {
      next.name = maybeName;
    }
    if (typeof maybeArgs === "string" && maybeArgs.length > 0) {
      next.argumentsText += maybeArgs;
    }
  }
  return next;
}

function appendToolCallDeltas(
  state: OpenAiChatCompletionsStreamState,
  delta: Record<string, unknown>,
  events: LLMStreamEvent[],
): void {
  const toolDeltas = (delta as { tool_calls?: Array<Record<string, unknown>> }).tool_calls;
  if (!Array.isArray(toolDeltas)) {
    return;
  }

  for (const toolDelta of toolDeltas) {
    const index =
      typeof toolDelta.index === "number" && Number.isFinite(toolDelta.index)
        ? toolDelta.index
        : state.toolCallBuffers.size;
    const current = state.toolCallBuffers.get(index) ?? { argumentsText: "" };
    state.toolCallBuffers.set(index, appendToolCallBuffer(current, toolDelta));
  }
  events.push({
    type: "tool_call_delta",
    toolCalls: structuredClone(toolDeltas),
  });
}

function appendLegacyFunctionCall(
  state: OpenAiChatCompletionsStreamState,
  delta: Record<string, unknown>,
): void {
  const legacyFunctionCall = (delta as { function_call?: { name?: string; arguments?: string } } | undefined)
    ?.function_call;
  if (!legacyFunctionCall) {
    return;
  }

  const legacy = state.toolCallBuffers.get(0) ?? { argumentsText: "" };
  if (typeof legacyFunctionCall.name === "string" && legacyFunctionCall.name.trim()) {
    legacy.name = legacyFunctionCall.name;
  }
  if (typeof legacyFunctionCall.arguments === "string" && legacyFunctionCall.arguments.length > 0) {
    legacy.argumentsText += legacyFunctionCall.arguments;
  }
  if (!legacy.id) {
    legacy.id = "legacy-fn-0";
  }
  state.toolCallBuffers.set(0, legacy);
}

export function consumeOpenAiChatCompletionsChunk(params: {
  chunk: StreamChunk;
  state: OpenAiChatCompletionsStreamState;
  mergeUsageCounters: (
    current: Record<string, number>,
    incoming: Record<string, unknown>
  ) => Record<string, number>;
}): LLMStreamEvent[] {
  const { chunk, state, mergeUsageCounters } = params;
  const events: LLMStreamEvent[] = [];
  updateUsage(state, chunk.usage, mergeUsageCounters);

  const choice = readFirstChoice(chunk);
  if (!choice) {
    return events;
  }
  if (typeof choice.finish_reason === "string" && choice.finish_reason.trim().length > 0) {
    state.finishReason = choice.finish_reason;
    state.sawFinishReason = true;
  }
  if (!choice.delta) {
    return events;
  }

  appendReasoningDelta(state, choice.delta, events);
  appendTextDelta(state, choice.delta, events);
  appendToolCallDeltas(state, choice.delta, events);
  appendLegacyFunctionCall(state, choice.delta);
  return events;
}

function finalizeToolCalls(params: {
  state: OpenAiChatCompletionsStreamState;
  parseToolCallArguments: (raw: unknown) => Record<string, unknown>;
}): ToolCallRequest[] {
  const toolCalls: ToolCallRequest[] = [];
  const orderedToolCalls = Array.from(params.state.toolCallBuffers.entries()).sort(([left], [right]) => left - right);
  for (const [index, call] of orderedToolCalls) {
    if (!call.name || !call.name.trim()) {
      continue;
    }
    toolCalls.push({
      id: call.id ?? `tool-${index}`,
      name: call.name.trim(),
      arguments: params.parseToolCallArguments(call.argumentsText)
    });
  }
  return toolCalls;
}

export function finalizeOpenAiChatCompletionsStreamResponse(params: {
  state: OpenAiChatCompletionsStreamState;
  parseToolCallArguments: (raw: unknown) => Record<string, unknown>;
}): LLMResponse {
  return {
    content: params.state.contentParts.join("") || null,
    toolCalls: finalizeToolCalls(params),
    finishReason: params.state.finishReason,
    usage: params.state.usage,
    reasoningContent: params.state.reasoningParts.join("").trim() || null
  };
}

export async function executeOpenAiChatCompletionsStreamRequest(params: {
  fetchImpl: typeof fetch;
  chatCompletionsUrl: string;
  apiKey?: string | null;
  extraHeaders?: Record<string, string> | null;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<Response> {
  const { fetchImpl, chatCompletionsUrl, apiKey, extraHeaders, body, signal } = params;
  return executeOpenAiStreamRequest({
    fetchImpl,
    url: chatCompletionsUrl,
    apiKey,
    extraHeaders,
    body,
    errorLabel: "Chat Completions API",
    signal,
    streamOptions: {
      include_usage: true,
    },
  });
}

export async function* consumeOpenAiChatCompletionsStream(params: {
  response: Response;
  apiBase: string | null;
  mergeUsageCounters: (
    current: Record<string, number>,
    incoming: Record<string, unknown>
  ) => Record<string, number>;
  parseToolCallArguments: (raw: unknown) => Record<string, unknown>;
}): AsyncGenerator<LLMStreamEvent> {
  const { response, apiBase, mergeUsageCounters, parseToolCallArguments } = params;
  const state = createOpenAiChatCompletionsStreamState();
  for await (const payload of readOpenAiSsePayloads(response)) {
    for (const event of consumeOpenAiChatCompletionsChunk({
      chunk: payload,
      state,
      mergeUsageCounters,
    })) {
      yield event;
    }
  }

  if (!state.sawFinishReason) {
    throw new Error(
      `Chat Completions stream ended without finish_reason${apiBase ? ` for base "${apiBase}"` : ""}.`,
    );
  }

  yield {
    type: "done",
    response: finalizeOpenAiChatCompletionsStreamResponse({
      state,
      parseToolCallArguments,
    }),
  };
}

export function mergeOpenAiUsageCounters(
  current: Record<string, number>,
  incoming: Record<string, unknown>
): Record<string, number> {
  const next = {
    ...current,
    ...normalizeStructuredUsageCounters(incoming, {})
  };
  if (typeof next.prompt_tokens !== "number") {
    next.prompt_tokens = 0;
  }
  if (typeof next.completion_tokens !== "number") {
    next.completion_tokens = 0;
  }
  if (typeof next.total_tokens !== "number") {
    next.total_tokens = 0;
  }
  return next;
}
