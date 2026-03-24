import {
  readArray,
  readBoolean,
  readNumber,
  readRecord,
  readString,
  withTrailingSlash,
  type CodexOpenAiResponsesBridgeConfig,
  type OpenAiChatCompletionResponse,
  type OpenResponsesItemRecord,
} from "./codex-openai-responses-bridge-shared.js";
function stripModelPrefix(model: string, prefixes: string[]): string {
  const normalizedModel = model.trim();
  for (const prefix of prefixes) {
    const normalizedPrefix = prefix.trim().toLowerCase();
    if (!normalizedPrefix) {
      continue;
    }
    const candidatePrefix = `${normalizedPrefix}/`;
    if (normalizedModel.toLowerCase().startsWith(candidatePrefix)) {
      return normalizedModel.slice(candidatePrefix.length);
    }
  }
  return normalizedModel;
}
function resolveUpstreamModel(
  requestedModel: unknown,
  config: CodexOpenAiResponsesBridgeConfig,
): string {
  const prefixes = (config.modelPrefixes ?? []).filter((value) => value.trim().length > 0);
  const model =
    stripModelPrefix(readString(requestedModel) ?? "", prefixes) ||
    stripModelPrefix(config.defaultModel ?? "", prefixes);
  if (!model) {
    throw new Error("Codex bridge could not resolve an upstream model.");
  }
  return model;
}
function normalizeTextPart(value: unknown): string {
  const record = readRecord(value);
  if (!record) {
    return "";
  }
  const type = readString(record.type);
  if (type !== "input_text" && type !== "output_text") {
    return "";
  }
  return readString(record.text) ?? "";
}
function normalizeImageUrl(value: unknown): string | null {
  const record = readRecord(value);
  if (!record || readString(record.type) !== "input_image") {
    return null;
  }
  const source = readRecord(record.source);
  if (!source) {
    return null;
  }
  if (readString(source.type) === "url") {
    return readString(source.url) ?? null;
  }
  if (readString(source.type) === "base64") {
    const mediaType = readString(source.media_type) ?? "application/octet-stream";
    const data = readString(source.data);
    if (!data) {
      return null;
    }
    return `data:${mediaType};base64,${data}`;
  }
  return null;
}
function normalizeToolOutput(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    const text = value.map((entry) => normalizeTextPart(entry)).filter(Boolean).join("");
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
function buildChatContent(
  content: unknown,
): string | Array<Record<string, unknown>> | null {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return null;
  }

  const chatContent: Array<Record<string, unknown>> = [];
  for (const entry of content) {
    const text = normalizeTextPart(entry);
    if (text) {
      chatContent.push({
        type: "text",
        text,
      });
      continue;
    }

    const imageUrl = normalizeImageUrl(entry);
    if (imageUrl) {
      chatContent.push({
        type: "image_url",
        image_url: {
          url: imageUrl,
        },
      });
    }
  }

  if (chatContent.length === 0) {
    return null;
  }
  const textOnly = chatContent.every((entry) => entry.type === "text");
  if (textOnly) {
    return chatContent
      .map((entry) => readString(entry.text) ?? "")
      .join("\n");
  }
  return chatContent;
}
function readAssistantMessageText(
  content: string | Array<Record<string, unknown>> | null,
): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter((entry) => entry.type === "text")
    .map((entry) => readString(entry.text) ?? "")
    .join("\n");
}
function appendMessageInputItem(params: {
  messages: Array<Record<string, unknown>>;
  assistantTextParts: string[];
  assistantToolCalls: Array<Record<string, unknown>>;
  item: OpenResponsesItemRecord;
  flushAssistant: () => void;
}): void {
  const role = readString(params.item.role);
  const content = buildChatContent(params.item.content);
  if (role === "assistant") {
    const text = readAssistantMessageText(content);
    if (text.trim()) {
      params.assistantTextParts.push(text);
    }
    return;
  }

  params.flushAssistant();
  const normalizedRole = role === "developer" ? "system" : role;
  if ((normalizedRole === "system" || normalizedRole === "user") && content !== null) {
    params.messages.push({
      role: normalizedRole,
      content,
    });
  }
}
function appendFunctionCallItem(params: {
  assistantToolCalls: Array<Record<string, unknown>>;
  item: OpenResponsesItemRecord;
}): void {
  const name = readString(params.item.name);
  const argumentsText = readString(params.item.arguments) ?? "{}";
  if (!name) {
    return;
  }
  const callId =
    readString(params.item.call_id) ??
    readString(params.item.id) ??
    `call_${params.assistantToolCalls.length}`;
  params.assistantToolCalls.push({
    id: callId,
    type: "function",
    function: {
      name,
      arguments: argumentsText,
    },
  });
}
function appendFunctionCallOutputItem(params: {
  messages: Array<Record<string, unknown>>;
  item: OpenResponsesItemRecord;
  flushAssistant: () => void;
}): void {
  params.flushAssistant();
  const callId = readString(params.item.call_id);
  if (!callId) {
    return;
  }
  params.messages.push({
    role: "tool",
    tool_call_id: callId,
    content: normalizeToolOutput(params.item.output),
  });
}
function buildOpenAiMessages(input: unknown, instructions: unknown): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  const instructionText = readString(instructions);
  if (instructionText) {
    messages.push({
      role: "system",
      content: instructionText,
    });
  }

  if (typeof input === "string") {
    return [
      ...messages,
      {
        role: "user",
        content: input,
      },
    ];
  }

  const assistantTextParts: string[] = [];
  const assistantToolCalls: Array<Record<string, unknown>> = [];
  const flushAssistant = () => {
    if (assistantTextParts.length === 0 && assistantToolCalls.length === 0) {
      return;
    }
    messages.push({
      role: "assistant",
      content: assistantTextParts.join("\n").trim() || null,
      ...(assistantToolCalls.length > 0
        ? {
            tool_calls: structuredClone(assistantToolCalls),
          }
        : {}),
    });
    assistantTextParts.length = 0;
    assistantToolCalls.length = 0;
  };

  for (const rawItem of readArray(input)) {
    const item = readRecord(rawItem) as OpenResponsesItemRecord | undefined;
    if (!item) {
      continue;
    }
    const type = readString(item.type);
    if (type === "message") {
      appendMessageInputItem({
        messages,
        assistantTextParts,
        assistantToolCalls,
        item,
        flushAssistant,
      });
      continue;
    }

    if (type === "function_call") {
      appendFunctionCallItem({
        assistantToolCalls,
        item,
      });
      continue;
    }

    if (type === "function_call_output") {
      appendFunctionCallOutputItem({
        messages,
        item,
        flushAssistant,
      });
    }
  }

  flushAssistant();
  return messages;
}

function toOpenAiTools(value: unknown): Array<Record<string, unknown>> | undefined {
  const tools: Array<Record<string, unknown>> = [];
  for (const entry of readArray(value)) {
    const tool = readRecord(entry);
    const type = readString(tool?.type);
    const fn = readRecord(tool?.function);
    const name = readString(fn?.name) ?? readString(tool?.name);
    if (type !== "function" || !name) {
      continue;
    }
    const description =
      (fn ? readString(fn.description) : undefined) ?? readString(tool?.description);
    const parameters =
      (fn ? readRecord(fn.parameters) : undefined) ?? readRecord(tool?.parameters);
    const strict =
      (fn ? readBoolean(fn.strict) : undefined) ?? readBoolean(tool?.strict);
    tools.push({
      type: "function",
      function: {
        name,
        ...(description ? { description } : {}),
        parameters: parameters ?? {
          type: "object",
          properties: {},
        },
        ...(strict !== undefined ? { strict } : {}),
      },
    });
  }
  return tools.length > 0 ? tools : undefined;
}

function toOpenAiToolChoice(value: unknown): Record<string, unknown> | string | undefined {
  if (value === "auto" || value === "none" || value === "required") {
    return value;
  }
  const record = readRecord(value);
  const fn = readRecord(record?.function);
  const name = readString(fn?.name) ?? readString(record?.name);
  if (readString(record?.type) === "function" && name) {
    return {
      type: "function",
      function: {
        name,
      },
    };
  }
  return undefined;
}

export async function callOpenAiCompatibleUpstream(params: {
  config: CodexOpenAiResponsesBridgeConfig;
  body: Record<string, unknown>;
}): Promise<{
  model: string;
  response: OpenAiChatCompletionResponse;
}> {
  const model = resolveUpstreamModel(params.body.model, params.config);
  const upstreamUrl = new URL(
    "chat/completions",
    withTrailingSlash(params.config.upstreamApiBase),
  );
  const tools = toOpenAiTools(params.body.tools);
  const toolChoice = toOpenAiToolChoice(params.body.tool_choice);
  const upstreamResponse = await fetch(upstreamUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(params.config.upstreamApiKey
        ? {
            Authorization: `Bearer ${params.config.upstreamApiKey}`,
          }
        : {}),
      ...(params.config.upstreamExtraHeaders ?? {}),
    },
    body: JSON.stringify({
      model,
      messages: buildOpenAiMessages(params.body.input, params.body.instructions),
      ...(tools ? { tools } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
      ...(typeof params.body.max_output_tokens === "number"
        ? {
            max_tokens: Math.max(
              1,
              Math.trunc(readNumber(params.body.max_output_tokens) ?? 1),
            ),
          }
        : {}),
    }),
  });

  const rawText = await upstreamResponse.text();
  let parsed: OpenAiChatCompletionResponse;
  try {
    parsed = JSON.parse(rawText) as OpenAiChatCompletionResponse;
  } catch {
    throw new Error(`Bridge upstream returned invalid JSON: ${rawText.slice(0, 240)}`);
  }

  if (!upstreamResponse.ok) {
    throw new Error(
      readString(parsed.error?.message) ??
        rawText.slice(0, 240) ??
        `HTTP ${upstreamResponse.status}`,
    );
  }

  return {
    model,
    response: parsed,
  };
}
