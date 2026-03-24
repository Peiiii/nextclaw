type AnthropicMessageBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content?: unknown };

type AnthropicRequestMessage = {
  role?: unknown;
  content?: unknown;
};

export type AnthropicMessagesRequest = {
  model?: unknown;
  system?: unknown;
  messages?: unknown;
  tools?: unknown;
  max_tokens?: unknown;
  stream?: unknown;
};

type OpenAiToolCall = {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
};

export type OpenAiChatCompletionsResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: unknown;
      tool_calls?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
  error?: {
    message?: unknown;
  };
};

export function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
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

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function withTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function buildAnthropicError(message: string): Record<string, unknown> {
  return {
    type: "error",
    error: {
      type: "api_error",
      message,
    },
  };
}

function readTextContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((entry) => {
      const record = readRecord(entry);
      if (!record || readString(record.type) !== "text") {
        return "";
      }
      return readString(record.text) ?? "";
    })
    .join("");
}

function normalizeToolResultContent(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    const text = value
      .map((entry) => {
        const record = readRecord(entry);
        if (!record || readString(record.type) !== "text") {
          return "";
        }
        return readString(record.text) ?? "";
      })
      .join("");
    if (text) {
      return text;
    }
  }
  try {
    return JSON.stringify(value ?? "");
  } catch {
    return String(value ?? "");
  }
}

function normalizeAnthropicBlocks(content: unknown): AnthropicMessageBlock[] {
  if (typeof content === "string") {
    return content.trim() ? [{ type: "text", text: content }] : [];
  }
  if (!Array.isArray(content)) {
    return [];
  }

  const blocks: AnthropicMessageBlock[] = [];
  for (const entry of content) {
    const record = readRecord(entry);
    if (!record) {
      continue;
    }
    const type = readString(record.type);
    if (type === "text") {
      const text = readString(record.text);
      if (text) {
        blocks.push({ type: "text", text });
      }
      continue;
    }
    if (type === "tool_use") {
      const id = readString(record.id);
      const name = readString(record.name);
      const input = readRecord(record.input) ?? {};
      if (id && name) {
        blocks.push({ type: "tool_use", id, name, input });
      }
      continue;
    }
    if (type === "tool_result") {
      const toolUseId = readString(record.tool_use_id);
      if (toolUseId) {
        blocks.push({ type: "tool_result", tool_use_id: toolUseId, content: record.content });
      }
    }
  }

  return blocks;
}

function normalizeAnthropicSystemMessages(system: unknown): Array<Record<string, unknown>> {
  const text = typeof system === "string" ? system : readTextContent(system);
  return text.trim() ? [{ role: "system", content: text }] : [];
}

export function toOpenAiMessages(request: AnthropicMessagesRequest): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [...normalizeAnthropicSystemMessages(request.system)];

  for (const rawMessage of readArray(request.messages)) {
    const message = rawMessage as AnthropicRequestMessage;
    const role = readString(message.role);
    if (role !== "user" && role !== "assistant") {
      continue;
    }

    const blocks = normalizeAnthropicBlocks(message.content);
    if (role === "assistant") {
      const text = blocks
        .filter((block): block is Extract<AnthropicMessageBlock, { type: "text" }> => block.type === "text")
        .map((block) => block.text)
        .join("");
      const toolCalls = blocks
        .filter((block): block is Extract<AnthropicMessageBlock, { type: "tool_use" }> => block.type === "tool_use")
        .map((block) => ({
          id: block.id,
          type: "function",
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input ?? {}),
          },
        }));

      if (text || toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: text || null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        });
      }
      continue;
    }

    let userText = "";
    for (const block of blocks) {
      if (block.type === "text") {
        userText += block.text;
        continue;
      }
      if (userText.trim()) {
        messages.push({ role: "user", content: userText });
        userText = "";
      }
      if (block.type === "tool_result") {
        messages.push({
          role: "tool",
          tool_call_id: block.tool_use_id,
          content: normalizeToolResultContent(block.content),
        });
      }
    }
    if (userText.trim()) {
      messages.push({ role: "user", content: userText });
    }
  }

  return messages;
}

export function toOpenAiTools(value: unknown): Array<Record<string, unknown>> | undefined {
  const tools: Array<Record<string, unknown>> = [];
  for (const entry of readArray(value)) {
    const tool = readRecord(entry);
    const name = readString(tool?.name);
    if (!tool || !name) {
      continue;
    }
    tools.push({
      type: "function",
      function: {
        name,
        description: readString(tool.description),
        parameters: readRecord(tool.input_schema) ?? {
          type: "object",
          properties: {},
        },
      },
    });
  }
  return tools.length > 0 ? tools : undefined;
}

function parseToolCallArguments(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string" || !raw.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeOpenAiContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((entry) => {
      const record = readRecord(entry);
      return readString(record?.text) ?? readString(record?.content) ?? "";
    })
    .join("");
}

function normalizeOpenAiToolCalls(value: unknown): OpenAiToolCall[] {
  return readArray(value)
    .map((entry, index) => {
      const record = readRecord(entry);
      const fn = readRecord(record?.function);
      const name = readString(fn?.name);
      if (!record || !fn || !name) {
        return null;
      }
      return {
        id: readString(record.id) ?? `tool-${index}`,
        function: {
          name,
          arguments: readString(fn.arguments) ?? "{}",
        },
      };
    })
    .filter((entry): entry is OpenAiToolCall => Boolean(entry));
}

function toAnthropicStopReason(value: string | null | undefined): string {
  if (value === "tool_calls") {
    return "tool_use";
  }
  if (value === "length") {
    return "max_tokens";
  }
  return "end_turn";
}

export function buildAnthropicMessageResponse(params: {
  requestModel: string;
  openAiResponse: OpenAiChatCompletionsResponse;
}): Record<string, unknown> {
  const choice = params.openAiResponse.choices?.[0];
  const content: Array<Record<string, unknown>> = [];
  const text = normalizeOpenAiContent(choice?.message?.content);
  if (text) {
    content.push({ type: "text", text });
  }
  for (const toolCall of normalizeOpenAiToolCalls(choice?.message?.tool_calls)) {
    content.push({
      type: "tool_use",
      id: toolCall.id,
      name: toolCall.function.name,
      input: parseToolCallArguments(toolCall.function.arguments),
    });
  }

  return {
    id: `msg_${randomUUID()}`,
    type: "message",
    role: "assistant",
    model: params.requestModel,
    content,
    stop_reason: toAnthropicStopReason(choice?.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: Math.max(0, Math.trunc(params.openAiResponse.usage?.prompt_tokens ?? 0)),
      output_tokens: Math.max(0, Math.trunc(params.openAiResponse.usage?.completion_tokens ?? 0)),
    },
  };
}

import { randomUUID } from "node:crypto";
