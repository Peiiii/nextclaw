import type { LLMResponse, ToolCallRequest } from "./base.js";

type ChatCompletionsMessage = {
  content?: string | null;
  tool_calls?: Array<Record<string, unknown>>;
  function_call?: { name?: string; arguments?: unknown };
  reasoning_content?: string;
  reasoning?: string;
};

type ChatCompletionsChoice = {
  message?: ChatCompletionsMessage;
  finish_reason?: string | null;
};

type ChatCompletionsResponseLike = {
  choices?: ChatCompletionsChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: unknown;
};

export class ChatCompletionsPayloadError extends Error {
  readonly code: "UPSTREAM_CHAT_COMPLETIONS_ERROR" | "INVALID_CHAT_COMPLETIONS_PAYLOAD";

  constructor(
    code: "UPSTREAM_CHAT_COMPLETIONS_ERROR" | "INVALID_CHAT_COMPLETIONS_PAYLOAD",
    message: string
  ) {
    super(message);
    this.name = "ChatCompletionsPayloadError";
    this.code = code;
  }
}

export function normalizeChatCompletionsResponse(
  response: unknown,
  parseToolCallArguments: (raw: unknown) => Record<string, unknown>
): LLMResponse {
  const responseAny = response as ChatCompletionsResponseLike;
  const upstreamError = extractUpstreamErrorMessage(responseAny.error);
  if (upstreamError) {
    throw new ChatCompletionsPayloadError(
      "UPSTREAM_CHAT_COMPLETIONS_ERROR",
      `Chat Completions API returned error payload: ${upstreamError}`
    );
  }
  if (!Array.isArray(responseAny.choices) || responseAny.choices.length === 0) {
    const preview = toPayloadPreview(responseAny);
    throw new ChatCompletionsPayloadError(
      "INVALID_CHAT_COMPLETIONS_PAYLOAD",
      `Chat Completions API returned invalid payload: missing choices[0]${preview ? ` | payload=${preview}` : ""}`
    );
  }

  const choice = responseAny.choices[0];
  const message = choice?.message;
  const toolCalls = toToolCalls(message, parseToolCallArguments);
  const reasoningContent =
    (message as { reasoning_content?: string } | undefined)?.reasoning_content ??
    (message as { reasoning?: string } | undefined)?.reasoning ??
    null;

  return {
    content: message?.content ?? null,
    toolCalls,
    finishReason: choice?.finish_reason ?? "stop",
    usage: {
      prompt_tokens: responseAny.usage?.prompt_tokens ?? 0,
      completion_tokens: responseAny.usage?.completion_tokens ?? 0,
      total_tokens: responseAny.usage?.total_tokens ?? 0
    },
    reasoningContent
  };
}

function toToolCalls(
  message: ChatCompletionsMessage | undefined,
  parseToolCallArguments: (raw: unknown) => Record<string, unknown>
): ToolCallRequest[] {
  const toolCalls: ToolCallRequest[] = [];

  if (message?.tool_calls) {
    for (const rawToolCall of message.tool_calls) {
      if (!rawToolCall || typeof rawToolCall !== "object" || Array.isArray(rawToolCall)) {
        continue;
      }
      const toolCall = rawToolCall as {
        type?: unknown;
        id?: unknown;
        function?: unknown;
      };
      if (toolCall.type !== "function") {
        continue;
      }
      const fn = toolCall.function;
      if (!fn || typeof fn !== "object" || Array.isArray(fn)) {
        continue;
      }
      const fnName = (fn as { name?: unknown }).name;
      if (typeof fnName !== "string" || fnName.trim().length === 0) {
        continue;
      }
      const args = parseToolCallArguments((fn as { arguments?: unknown }).arguments);
      toolCalls.push({
        id: typeof toolCall.id === "string" && toolCall.id.trim().length > 0 ? toolCall.id : `tool-${toolCalls.length}`,
        name: fnName,
        arguments: args
      });
    }
  }

  const legacyFunctionCall = (message as { function_call?: { name?: string; arguments?: unknown } } | undefined)
    ?.function_call;
  if (legacyFunctionCall?.name) {
    toolCalls.push({
      id: `legacy-fn-${toolCalls.length}`,
      name: legacyFunctionCall.name,
      arguments: parseToolCallArguments(legacyFunctionCall.arguments)
    });
  }

  return toolCalls;
}

function extractUpstreamErrorMessage(errorPayload: unknown): string | null {
  if (!errorPayload) {
    return null;
  }
  if (typeof errorPayload === "string") {
    const trimmed = errorPayload.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (errorPayload && typeof errorPayload === "object" && !Array.isArray(errorPayload)) {
    const payload = errorPayload as { message?: unknown; error?: unknown; code?: unknown; type?: unknown };
    if (typeof payload.message === "string" && payload.message.trim().length > 0) {
      return payload.message.trim();
    }
    if (typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error.trim();
    }
    const pieces = [payload.type, payload.code]
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean);
    if (pieces.length > 0) {
      return pieces.join(" ");
    }
  }
  return null;
}

function toPayloadPreview(payload: unknown): string {
  try {
    return JSON.stringify(payload).slice(0, 240);
  } catch {
    return String(payload ?? "").slice(0, 240);
  }
}
