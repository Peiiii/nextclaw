export type CodexOpenAiResponsesBridgeConfig = {
  upstreamApiBase: string;
  upstreamApiKey?: string;
  upstreamExtraHeaders?: Record<string, string>;
  defaultModel?: string;
  modelPrefixes?: string[];
};

export type CodexOpenAiResponsesBridgeResult = {
  baseUrl: string;
};

export type BridgeEntry = {
  promise: Promise<CodexOpenAiResponsesBridgeResult>;
};

export type OpenResponsesItemRecord = Record<string, unknown>;

export type OpenAiChatCompletionChoiceMessage = {
  content?: unknown;
  tool_calls?: unknown;
};

export type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: OpenAiChatCompletionChoiceMessage;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: unknown;
  };
};

export type OpenResponsesOutputItem = Record<string, unknown>;

export type StreamSequenceState = {
  value: number;
};

export function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function readNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return value;
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

export function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function writeSseEvent(
  response: { write: (chunk: string) => void },
  eventType: string,
  payload: Record<string, unknown>,
): void {
  response.write(`event: ${eventType}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function nextSequenceNumber(state: StreamSequenceState): number {
  const nextValue = state.value;
  state.value += 1;
  return nextValue;
}
