import type { ServerResponse } from "node:http";
import { buildAssistantOutputItems } from "@codex-plugin-sdk/codex-openai-responses-bridge-assistant-output.utils.js";
import {
  readArray,
  readNumber,
  readRecord,
  readString,
  writeSseEvent,
  type OpenAiChatCompletionResponse,
  type OpenResponsesOutputItem,
} from "@codex-plugin-sdk/codex-openai-responses-bridge-shared.utils.js";

function buildOpenResponsesOutputItems(
  response: OpenAiChatCompletionResponse,
  responseId: string,
): OpenResponsesOutputItem[] {
  const message = response.choices?.[0]?.message;
  if (!message) {
    return [];
  }

  const outputItems = buildAssistantOutputItems({
    message,
    responseId,
  });

  const toolCalls = readArray(message.tool_calls);
  toolCalls.forEach((entry, index) => {
    const toolCall = readRecord(entry);
    const fn = readRecord(toolCall?.function);
    const name = readString(fn?.name);
    const argumentsText = readString(fn?.arguments) ?? "{}";
    if (!name) {
      return;
    }
    const callId =
      readString(toolCall?.id) ??
      `${responseId}:call:${index}`;
    outputItems.push({
      type: "function_call",
      id: `${responseId}:function:${index}`,
      call_id: callId,
      name,
      arguments: argumentsText,
      status: "completed",
    });
  });

  return outputItems;
}

function normalizeUsageValue(value: unknown): number | Record<string, unknown> | null {
  const numericValue = readNumber(value);
  if (numericValue !== undefined) {
    return Math.max(0, Math.trunc(numericValue));
  }
  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    const normalizedEntry = normalizeUsageValue(entry);
    if (normalizedEntry !== null) {
      next[key] = normalizedEntry;
    }
  }
  return Object.keys(next).length > 0 ? next : null;
}

function normalizeUsageRecord(rawUsage: unknown): Record<string, unknown> {
  const usage = readRecord(rawUsage);
  if (!usage) {
    return {};
  }
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(usage)) {
    const normalizedValue = normalizeUsageValue(value);
    if (normalizedValue === null) {
      continue;
    }
    if (key === "prompt_tokens") {
      next.input_tokens = normalizedValue;
      continue;
    }
    if (key === "completion_tokens") {
      next.output_tokens = normalizedValue;
      continue;
    }
    if (key === "prompt_tokens_details") {
      next.input_tokens_details = normalizedValue;
      continue;
    }
    if (key === "completion_tokens_details") {
      next.output_tokens_details = normalizedValue;
      continue;
    }
    next[key] = normalizedValue;
  }
  return next;
}

export function buildUsage(response: OpenAiChatCompletionResponse): Record<string, unknown> {
  const promptTokens = Math.max(0, Math.trunc(readNumber(response.usage?.prompt_tokens) ?? 0));
  const completionTokens = Math.max(
    0,
    Math.trunc(readNumber(response.usage?.completion_tokens) ?? 0),
  );
  const totalTokens = Math.max(
    0,
    Math.trunc(readNumber(response.usage?.total_tokens) ?? promptTokens + completionTokens),
  );
  return {
    ...normalizeUsageRecord(response.usage),
    input_tokens: promptTokens,
    output_tokens: completionTokens,
    total_tokens: totalTokens,
  };
}

export function buildResponseResource(params: {
  responseId: string;
  model: string;
  outputItems: OpenResponsesOutputItem[];
  usage: Record<string, unknown>;
  status?: "in_progress" | "completed";
}): Record<string, unknown> {
  const { model, outputItems, responseId, status, usage } = params;
  return {
    id: responseId,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status: status ?? "completed",
    model,
    output: outputItems,
    usage,
    error: null,
  };
}

export function writeStreamError(response: ServerResponse, message: string): void {
  new StreamErrorWriter(response, message).write();
}

class StreamErrorWriter {
  constructor(
    private readonly response: ServerResponse,
    private readonly message: string,
  ) {}

  write = (): void => {
    this.response.statusCode = 200;
    this.response.setHeader("content-type", "text/event-stream; charset=utf-8");
    this.response.setHeader("cache-control", "no-cache, no-transform");
    this.response.setHeader("connection", "keep-alive");
    writeSseEvent(this.response, "error", {
      type: "error",
      error: {
        code: "invalid_request_error",
        message: this.message,
      },
    });
    this.response.end();
  };
}

export function buildBridgeResponsePayload(params: {
  responseId: string;
  model: string;
  response: OpenAiChatCompletionResponse;
}): {
  outputItems: OpenResponsesOutputItem[];
  usage: Record<string, unknown>;
  responseResource: Record<string, unknown>;
} {
  const { model, response, responseId } = params;
  const outputItems = buildOpenResponsesOutputItems(response, responseId);
  const usage = buildUsage(response);
  return {
    outputItems,
    usage,
    responseResource: buildResponseResource({
      responseId,
      model,
      outputItems,
      usage,
    }),
  };
}
