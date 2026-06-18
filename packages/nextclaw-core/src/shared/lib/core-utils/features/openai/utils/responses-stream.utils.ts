import type { LLMResponse, LLMStreamEvent } from "@core/features/llm-providers/index.js";
import { isSemanticallyEmptyOpenAiResponse, normalizeOpenAiResponsesOutput } from "./response.utils.js";
import { parseOpenAiResponsesPayload } from "./responses-payload.utils.js";
import {
  buildFallbackResponse,
  consumeOpenAiResponsesEvent,
  createOpenAiResponsesStreamState,
} from "./responses-stream-state.utils.js";
import {
  executeOpenAiStreamRequest,
  parseOpenAiSsePayload,
  parseOpenAiSsePayloadsFromText,
  readOpenAiSseFrames,
} from "./sse-stream.utils.js";

export async function executeOpenAiResponsesStreamRequest(params: {
  fetchImpl: typeof fetch;
  responseUrl: string;
  apiKey?: string | null;
  extraHeaders?: Record<string, string> | null;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<Response> {
  const { fetchImpl, responseUrl, apiKey, extraHeaders, body, signal } = params;
  return executeOpenAiStreamRequest({
    fetchImpl,
    url: responseUrl,
    apiKey,
    extraHeaders,
    body,
    errorLabel: "Responses API",
    signal,
  });
}

export async function* consumeOpenAiResponsesStream(params: {
  response: Response;
  apiBase: string | null;
  normalizeUsageCounters: (raw: Record<string, unknown> | undefined) => Record<string, number>;
  parseToolCallArguments: (raw: unknown) => Record<string, unknown>;
}): AsyncGenerator<LLMStreamEvent> {
  const contentType = params.response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!params.response.body || !contentType.includes("text/event-stream")) {
    const rawText = await params.response.text();
    if (looksLikeSseText(rawText)) {
      yield* consumeSseTextResponse({
        rawText,
        apiBase: params.apiBase,
        normalizeUsageCounters: params.normalizeUsageCounters,
        parseToolCallArguments: params.parseToolCallArguments,
      });
      return;
    }
    yield {
      type: "done",
      response: normalizeNonStreamingResponse({
        rawText,
        apiBase: params.apiBase,
        normalizeUsageCounters: params.normalizeUsageCounters,
      }),
    };
    return;
  }

  const state = createOpenAiResponsesStreamState();
  for await (const payload of readOpenAiResponsesPayloads(params.response.body)) {
    for (const event of consumeOpenAiResponsesEvent({
      payload,
      state,
    })) {
      yield event;
    }
    if (isCompletedResponsesPayload(payload, state.responsePayload)) {
      break;
    }
  }

  const response = finalizeStreamingResponse({
    state,
    normalizeUsageCounters: params.normalizeUsageCounters,
    parseToolCallArguments: params.parseToolCallArguments,
  });
  yield {
    type: "done",
    response: assertNonEmptyOpenAiResponse(response, params.apiBase),
  };
}

function normalizeNonStreamingResponse(params: {
  rawText: string;
  apiBase: string | null;
  normalizeUsageCounters: (raw: Record<string, unknown> | undefined) => Record<string, number>;
}): LLMResponse {
  return assertNonEmptyOpenAiResponse(
    normalizeOpenAiResponsesPayload({
      payload: parseOpenAiResponsesPayload(params.rawText),
      normalizeUsageCounters: params.normalizeUsageCounters,
    }),
    params.apiBase,
  );
}

function normalizeOpenAiResponsesPayload(params: {
  payload: Record<string, unknown>;
  normalizeUsageCounters: (raw: Record<string, unknown> | undefined) => Record<string, number>;
}): LLMResponse {
  const responseAny = params.payload as {
    output?: Array<Record<string, unknown>>;
    usage?: Record<string, number>;
    status?: string;
  };
  return normalizeOpenAiResponsesOutput({
    ...responseAny,
    usage: params.normalizeUsageCounters(responseAny.usage as Record<string, unknown> | undefined),
  });
}

function assertNonEmptyOpenAiResponse(response: LLMResponse, apiBase: string | null): LLMResponse {
  if (isSemanticallyEmptyOpenAiResponse(response)) {
    throw new Error(
      `Responses API returned an empty assistant response${apiBase ? ` for base "${apiBase}"` : ""}.`,
    );
  }
  return response;
}

function finalizeStreamingResponse(params: {
  state: {
    responsePayload: Record<string, unknown> | null;
  } & Parameters<typeof buildFallbackResponse>[0]["state"];
  normalizeUsageCounters: (raw: Record<string, unknown> | undefined) => Record<string, number>;
  parseToolCallArguments: (raw: unknown) => Record<string, unknown>;
}): LLMResponse {
  const fallbackResponse = buildFallbackResponse({
    state: params.state,
    parseToolCallArguments: params.parseToolCallArguments,
  });
  if (!params.state.responsePayload) {
    return fallbackResponse;
  }

  const normalizedResponse = normalizeOpenAiResponsesPayload({
    payload: params.state.responsePayload,
    normalizeUsageCounters: params.normalizeUsageCounters,
  });
  if (!isSemanticallyEmptyOpenAiResponse(normalizedResponse)) {
    return normalizedResponse;
  }

  return {
    ...fallbackResponse,
    usage: normalizedResponse.usage,
    finishReason: normalizedResponse.finishReason || fallbackResponse.finishReason,
    reasoningContent: fallbackResponse.reasoningContent ?? normalizedResponse.reasoningContent ?? null,
  };
}

function isCompletedResponsesPayload(
  payload: Record<string, unknown>,
  responsePayload: Record<string, unknown> | null,
): boolean {
  return payload.type === "response.completed" && responsePayload !== null;
}

function looksLikeSseText(rawText: string): boolean {
  return /(^|\n)\s*(event:|data:)/.test(rawText);
}

async function* consumeSseTextResponse(params: {
  rawText: string;
  apiBase: string | null;
  normalizeUsageCounters: (raw: Record<string, unknown> | undefined) => Record<string, number>;
  parseToolCallArguments: (raw: unknown) => Record<string, unknown>;
}): AsyncGenerator<LLMStreamEvent> {
  const { rawText, apiBase, normalizeUsageCounters, parseToolCallArguments } = params;
  const state = createOpenAiResponsesStreamState();
  for (const payload of parseOpenAiSsePayloadsFromText(rawText)) {
    for (const event of consumeOpenAiResponsesEvent({
      payload,
      state,
    })) {
      yield event;
    }
    if (isCompletedResponsesPayload(payload, state.responsePayload)) {
      break;
    }
  }

  yield {
    type: "done",
    response: assertNonEmptyOpenAiResponse(
      finalizeStreamingResponse({
        state,
        normalizeUsageCounters,
        parseToolCallArguments,
      }),
      apiBase,
    ),
  };
}

async function* readOpenAiResponsesPayloads(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  for await (const frame of readOpenAiSseFrames(stream)) {
    const payload = parseOpenAiSsePayload(frame.data);
    if (payload) {
      yield payload;
    }
  }
}
