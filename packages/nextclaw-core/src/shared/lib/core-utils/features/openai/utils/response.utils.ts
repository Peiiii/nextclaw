import type { LLMResponse, ToolCallRequest } from "../../providers/base.js";
import { ChatCompletionsPayloadError } from "../../providers/chat-completions-normalizer.js";

type ResponsesPayload = {
  output?: Array<Record<string, unknown>>;
  usage?: Record<string, number>;
  status?: string;
};

export function buildOpenAiApiBaseCandidates(apiBase: string | null): Array<string | null> {
  const normalized = typeof apiBase === "string" ? apiBase.trim() : "";
  if (!normalized) {
    return [null];
  }

  const candidates = [normalized];
  try {
    const parsed = new URL(normalized);
    if (parsed.pathname === "/" || parsed.pathname === "") {
      parsed.pathname = "/v1";
      const versioned = parsed.toString();
      if (!candidates.includes(versioned)) {
        candidates.push(versioned);
      }
    }
  } catch {
    return candidates;
  }
  return candidates;
}

export function isSemanticallyEmptyOpenAiResponse(response: LLMResponse): boolean {
  const text = typeof response.content === "string" ? response.content.trim() : "";
  const reasoning = typeof response.reasoningContent === "string" ? response.reasoningContent.trim() : "";
  return text.length === 0 && reasoning.length === 0 && response.toolCalls.length === 0;
}

export function createEmptyChatCompletionsPayloadError(apiBase: string | null): ChatCompletionsPayloadError {
  const suffix = apiBase ? ` for base "${apiBase}"` : "";
  return new ChatCompletionsPayloadError(
    "INVALID_CHAT_COMPLETIONS_PAYLOAD",
    `Chat Completions API returned an empty assistant response${suffix}`
  );
}

function appendReasoningSummary(item: Record<string, unknown>, current: string | null): string | null {
  if (item.type !== "reasoning" || !Array.isArray(item.summary)) {
    return current;
  }
  const summaryText = item.summary
    .map((entry) => (typeof entry === "string" ? entry : String((entry as { text?: string }).text ?? "")))
    .filter(Boolean)
    .join("\n");
  return summaryText || current;
}

function appendMessageContent(item: Record<string, unknown>, contentParts: string[]): void {
  if (item.type !== "message" || !Array.isArray(item.content)) {
    return;
  }

  for (const part of item.content as Array<Record<string, unknown>>) {
    if (part.type !== "output_text" && part.type !== "text") {
      continue;
    }
    const text = String(part.text ?? "");
    if (text) {
      contentParts.push(text);
    }
  }
}

function toToolCall(item: Record<string, unknown>, index: number): ToolCallRequest | null {
  if (item.type !== "tool_call" && item.type !== "function_call") {
    return null;
  }

  const itemFunction = item.function as Record<string, unknown> | undefined;
  const name = String(item.name ?? itemFunction?.name ?? "");
  const rawArgs =
    item.arguments ??
    itemFunction?.arguments ??
    item.input ??
    itemFunction?.input ??
    "{}";
  let args: Record<string, unknown> = {};
  try {
    args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : (rawArgs as Record<string, unknown>);
  } catch {
    args = {};
  }

  return {
    id: String(item.id ?? item.call_id ?? `${name}-${index}`),
    name,
    arguments: args
  };
}

function normalizeResponsesUsage(usage: Record<string, number> | undefined): Record<string, number> {
  const normalized = usage ?? {};
  const promptTokens = normalized.input_tokens ?? normalized.prompt_tokens ?? 0;
  const completionTokens = normalized.output_tokens ?? normalized.completion_tokens ?? 0;
  const totalTokens = normalized.total_tokens ?? promptTokens + completionTokens;
  return {
    ...normalized,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens
  };
}

export function normalizeOpenAiResponsesOutput(responseAny: ResponsesPayload): LLMResponse {
  const toolCalls: ToolCallRequest[] = [];
  const contentParts: string[] = [];
  let reasoningContent: string | null = null;

  for (const [index, item] of (responseAny.output ?? []).entries()) {
    reasoningContent = appendReasoningSummary(item, reasoningContent);
    appendMessageContent(item, contentParts);
    const toolCall = toToolCall(item, index);
    if (toolCall) {
      toolCalls.push(toolCall);
    }
  }

  return {
    content: contentParts.join("") || null,
    toolCalls,
    finishReason: responseAny.status ?? "stop",
    usage: normalizeResponsesUsage(responseAny.usage),
    reasoningContent
  };
}
