import type { LLMResponse, LLMStreamEvent } from "../../providers/base.js";
import { isSemanticallyEmptyOpenAiResponse, normalizeOpenAiResponsesOutput } from "./response.utils.js";
import { parseOpenAiResponsesPayload } from "./responses-payload.utils.js";
import {
  buildFallbackResponse,
  consumeOpenAiResponsesEvent,
  createOpenAiResponsesStreamState,
} from "./responses-stream-state.utils.js";

type OpenAiResponsesRequestError = Error & {
  status?: number;
  responseUrl?: string;
  bodyPreview?: string;
  responseText?: string;
};

type OpenAiResponsesSseFrame = {
  data: string;
};

export async function executeOpenAiResponsesStreamRequest(params: {
  fetchImpl: typeof fetch;
  responseUrl: string;
  apiKey?: string | null;
  extraHeaders?: Record<string, string> | null;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "text/event-stream, application/json",
    ...(params.extraHeaders ?? {}),
  };
  if (params.apiKey) {
    headers.Authorization = `Bearer ${params.apiKey}`;
  }

  const attempt = await params.fetchImpl(params.responseUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ...params.body,
      stream: true,
    }),
    signal: params.signal,
  });

  if (!attempt.ok) {
    const text = await attempt.text();
    const preview = text.slice(0, 200);
    const error = new Error(
      `Responses API failed (${attempt.status}): ${preview}`,
    ) as OpenAiResponsesRequestError;
    error.status = attempt.status;
    error.responseUrl = params.responseUrl;
    error.bodyPreview = preview;
    error.responseText = text;
    throw error;
  }

  return attempt;
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
  const state = createOpenAiResponsesStreamState();
  for (const payload of parseSsePayloadsFromText(params.rawText)) {
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
        normalizeUsageCounters: params.normalizeUsageCounters,
        parseToolCallArguments: params.parseToolCallArguments,
      }),
      params.apiBase,
    ),
  };
}

async function* readOpenAiResponsesPayloads(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, unknown>> {
  for await (const frame of readOpenAiResponsesSseFrames(stream)) {
    const payload = parseSsePayload(frame.data);
    if (payload) {
      yield payload;
    }
  }
}

async function* readOpenAiResponsesSseFrames(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<OpenAiResponsesSseFrame> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const frame = parseSseFrame(chunk);
        if (frame) {
          yield frame;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const frame = parseSseFrame(buffer);
      if (frame) {
        yield frame;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSseFrame(chunk: string): OpenAiResponsesSseFrame | null {
  const lines = chunk.split(/\r?\n/);
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    data: dataLines.join("\n"),
  };
}

function* parseSsePayloadsFromText(text: string): Generator<Record<string, unknown>> {
  const chunks = text.split(/\r?\n\r?\n/);
  for (const chunk of chunks) {
    const frame = parseSseFrame(chunk);
    const payload = frame ? parseSsePayload(frame.data) : null;
    if (payload) {
      yield payload;
    }
  }
}

function parseSsePayload(data: string): Record<string, unknown> | null {
  if (!data || data === "[DONE]") {
    return null;
  }
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return null;
  }
}
