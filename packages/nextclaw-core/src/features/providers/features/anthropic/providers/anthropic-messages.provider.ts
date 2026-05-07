import { LLMProvider, type LLMResponse, type ToolCallRequest } from "../base.js";
import type { ThinkingLevel } from "../../utils/thinking.js";

type AnthropicMessagesProviderOptions = {
  apiKey?: string | null;
  apiBase?: string | null;
  defaultModel: string;
  extraHeaders?: Record<string, string> | null;
};

type AnthropicTextBlock = {
  type: "text";
  text: string;
};

type AnthropicToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

type AnthropicToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
};

type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeApiBase(value: string | null | undefined): string | null {
  const trimmed = readString(value);
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/, "");
}

function buildMessagesEndpointCandidates(apiBase: string | null | undefined): string[] {
  const normalized = normalizeApiBase(apiBase) ?? "https://api.anthropic.com";
  const candidates = new Set<string>();

  const addCandidate = (base: string, path: string) => {
    const withSlash = base.endsWith("/") ? base : `${base}/`;
    candidates.add(new URL(path, withSlash).toString());
  };

  if (normalized.endsWith("/v1")) {
    addCandidate(normalized, "messages");
    addCandidate(normalized.slice(0, -3), "v1/messages");
  } else {
    addCandidate(normalized, "v1/messages");
    addCandidate(normalized, "messages");
  }

  return Array.from(candidates);
}

function normalizeTextBlocks(content: unknown): AnthropicTextBlock[] {
  if (typeof content === "string") {
    return content.trim().length > 0 ? [{ type: "text", text: content }] : [];
  }
  if (!Array.isArray(content)) {
    return [];
  }

  const blocks: AnthropicTextBlock[] = [];
  for (const entry of content) {
    const record = readRecord(entry);
    const type = readString(record?.type);
    const text = readString(record?.text);
    if (!type || !text) {
      continue;
    }
    if (type === "text" || type === "input_text" || type === "output_text") {
      blocks.push({ type: "text", text });
    }
  }
  return blocks;
}

function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  const text = readString(raw);
  if (!text) {
    return {};
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    return readRecord(parsed) ?? {};
  } catch {
    return {};
  }
}

function normalizeToolResultContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  const textBlocks = normalizeTextBlocks(content);
  if (textBlocks.length > 0) {
    return textBlocks.map((block) => block.text).join("\n");
  }
  try {
    return JSON.stringify(content ?? "");
  } catch {
    return String(content ?? "");
  }
}

function buildAnthropicSystem(messages: Array<Record<string, unknown>>): string | undefined {
  const parts = messages
    .filter((message) => readString(message.role) === "system")
    .flatMap((message) => normalizeTextBlocks(message.content))
    .map((block) => block.text.trim())
    .filter((text) => text.length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join("\n\n");
}

function buildAnthropicMessages(messages: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  let pendingToolResults: AnthropicToolResultBlock[] = [];

  const flushToolResults = () => {
    if (pendingToolResults.length === 0) {
      return;
    }
    out.push({
      role: "user",
      content: [...pendingToolResults]
    });
    pendingToolResults = [];
  };

  for (const message of messages) {
    const role = readString(message.role);
    if (!role || role === "system") {
      continue;
    }
    if (role === "tool") {
      const toolUseId = readString(message.tool_call_id);
      if (!toolUseId) {
        continue;
      }
      pendingToolResults.push({
        type: "tool_result",
        tool_use_id: toolUseId,
        content: normalizeToolResultContent(message.content)
      });
      continue;
    }

    flushToolResults();

    if (role === "assistant") {
      const content: AnthropicContentBlock[] = [
        ...normalizeTextBlocks(message.content),
        ...readArray(message.tool_calls).flatMap((entry, index) => {
          const record = readRecord(entry);
          const fn = readRecord(record?.function);
          const name = readString(fn?.name);
          if (!name) {
            return [];
          }
          return [{
            type: "tool_use" as const,
            id: readString(record?.id) ?? `tool-${index}`,
            name,
            input: parseToolArguments(fn?.arguments)
          }];
        })
      ];
      if (content.length > 0) {
        out.push({ role: "assistant", content });
      }
      continue;
    }

    if (role === "user") {
      const content = normalizeTextBlocks(message.content);
      if (content.length > 0) {
        out.push({ role: "user", content });
      }
    }
  }

  flushToolResults();
  return out;
}

function buildAnthropicTools(tools: Array<Record<string, unknown>> | undefined): Array<Record<string, unknown>> | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }
  const normalized = tools.flatMap((tool) => {
    const functionSpec = readRecord(tool.function);
    const name = readString(functionSpec?.name);
    if (!name) {
      return [];
    }
    return [{
      name,
      ...(readString(functionSpec?.description) ? { description: readString(functionSpec?.description) } : {}),
      input_schema: readRecord(functionSpec?.parameters) ?? {
        type: "object",
        properties: {}
      }
    }];
  });
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeUsage(usage: Record<string, unknown> | null): Record<string, number> {
  const inputTokens = typeof usage?.input_tokens === "number" ? usage.input_tokens : 0;
  const outputTokens = typeof usage?.output_tokens === "number" ? usage.output_tokens : 0;
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    prompt_tokens: inputTokens,
    completion_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens
  };
}

function normalizeResponse(payload: Record<string, unknown>): LLMResponse {
  const contentBlocks = readArray(payload.content);
  const textParts: string[] = [];
  const reasoningParts: string[] = [];
  const toolCalls: ToolCallRequest[] = [];

  for (const entry of contentBlocks) {
    const record = readRecord(entry);
    const type = readString(record?.type);
    if (!type) {
      continue;
    }
    if (type === "text") {
      const text = readString(record?.text);
      if (text) {
        textParts.push(text);
      }
      continue;
    }
    if (type === "thinking" || type === "reasoning") {
      const text = readString(record?.thinking) ?? readString(record?.text);
      if (text) {
        reasoningParts.push(text);
      }
      continue;
    }
    if (type === "tool_use") {
      const name = readString(record?.name);
      const id = readString(record?.id) ?? `tool-${toolCalls.length}`;
      if (!name) {
        continue;
      }
      toolCalls.push({
        id,
        name,
        arguments: readRecord(record?.input) ?? {}
      });
    }
  }

  return {
    content: textParts.join("").trim() || null,
    toolCalls,
    finishReason: readString(payload.stop_reason) ?? "stop",
    usage: normalizeUsage(readRecord(payload.usage)),
    reasoningContent: reasoningParts.join("\n").trim() || null
  };
}

function buildRequestHeaders(params: {
  apiKey?: string | null;
  extraHeaders?: Record<string, string> | null;
}): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01"
  });
  const apiKey = readString(params.apiKey);
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
  for (const [key, value] of Object.entries(params.extraHeaders ?? {})) {
    if (key.trim().length > 0 && value.trim().length > 0) {
      headers.set(key, value);
    }
  }
  return headers;
}

function readErrorMessage(payload: Record<string, unknown> | null, fallback: string): string {
  const errorRecord = readRecord(payload?.error);
  return readString(errorRecord?.message) ?? readString(payload?.message) ?? fallback;
}

export class AnthropicMessagesProvider extends LLMProvider {
  private readonly defaultModel: string;
  private readonly extraHeaders: Record<string, string> | null;

  constructor(options: AnthropicMessagesProviderOptions) {
    const { apiKey, apiBase, defaultModel, extraHeaders } = options;
    super(apiKey, apiBase);
    this.defaultModel = defaultModel;
    this.extraHeaders = extraHeaders ?? null;
  }

  getDefaultModel = (): string => {
    return this.defaultModel;
  };

  chat = async (params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    thinkingLevel?: ThinkingLevel | null;
    signal?: AbortSignal;
  }): Promise<LLMResponse> => {
    const { maxTokens, messages, model: requestedModel, signal, tools } = params;
    const model = readString(requestedModel) ?? this.defaultModel;
    const body: Record<string, unknown> = {
      model,
      messages: buildAnthropicMessages(messages),
      max_tokens: Math.max(16, Math.trunc(maxTokens ?? 4096))
    };
    const system = buildAnthropicSystem(messages);
    if (system) {
      body.system = system;
    }
    const anthropicTools = buildAnthropicTools(tools);
    if (anthropicTools) {
      body.tools = anthropicTools;
    }

    let lastError: unknown = null;
    for (const endpoint of buildMessagesEndpointCandidates(this.apiBase)) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: buildRequestHeaders({
            apiKey: this.apiKey,
            extraHeaders: this.extraHeaders
          }),
          body: JSON.stringify(body),
          signal
        });
        const rawText = await response.text();
        const parsed = rawText.trim().length > 0
          ? (JSON.parse(rawText) as Record<string, unknown>)
          : {};
        if (!response.ok) {
          const error = new Error(readErrorMessage(parsed, rawText.slice(0, 240) || `HTTP ${response.status}`)) as Error & {
            status?: number;
          };
          error.status = response.status;
          throw error;
        }
        return normalizeResponse(parsed);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error("Anthropic Messages request failed.");
  };
}
