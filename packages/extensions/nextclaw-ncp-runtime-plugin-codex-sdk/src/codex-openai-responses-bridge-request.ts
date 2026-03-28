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
import {
  buildChatContent,
  mergeChatContent,
  normalizeToolOutput,
  readAssistantMessageText,
  type OpenAiChatContent,
} from "./codex-openai-responses-bridge-message-content.js";
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
function appendMessageInputItem(params: {
  messages: Array<Record<string, unknown>>;
  systemContent: OpenAiChatContent;
  assistantTextParts: string[];
  assistantToolCalls: Array<Record<string, unknown>>;
  item: OpenResponsesItemRecord;
  flushAssistant: () => void;
}): OpenAiChatContent {
  const role = readString(params.item.role);
  const content = buildChatContent(params.item.content);
  if (role === "assistant") {
    const text = readAssistantMessageText(content);
    if (text.trim()) {
      params.assistantTextParts.push(text);
    }
    return params.systemContent;
  }

  params.flushAssistant();
  const normalizedRole = role === "developer" ? "system" : role;
  if (normalizedRole === "system") {
    return mergeChatContent(params.systemContent, content);
  }
  if (normalizedRole === "user" && content !== null) {
    params.messages.push({
      role: "user",
      content,
    });
  }
  return params.systemContent;
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
  let systemContent: OpenAiChatContent = readString(instructions) ?? null;

  if (typeof input === "string") {
    messages.push({
      role: "user",
      content: input,
    });
    return systemContent === null
      ? messages
      : [
          {
            role: "system",
            content: systemContent,
          },
          ...messages,
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
      systemContent = appendMessageInputItem({
        messages,
        systemContent,
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
  return systemContent === null
    ? messages
    : [
        {
          role: "system",
          content: systemContent,
        },
        ...messages,
      ];
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
