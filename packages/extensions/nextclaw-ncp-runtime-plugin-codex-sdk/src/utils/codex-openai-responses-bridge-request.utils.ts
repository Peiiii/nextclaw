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
} from "@codex-plugin-sdk/codex-openai-responses-bridge-shared.utils.js";
import {
  buildChatContent,
  mergeChatContent,
  normalizeToolOutput,
  readAssistantMessageText,
  type OpenAiChatContent,
} from "@codex-plugin-sdk/codex-openai-responses-bridge-message-content.utils.js";
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
function buildOpenAiMessages(input: unknown, instructions: unknown): Array<Record<string, unknown>> {
  return new OpenAiMessagesBuilder(input, instructions).build();
}

class OpenAiMessagesBuilder {
  private readonly messages: Array<Record<string, unknown>> = [];
  private readonly assistantTextParts: string[] = [];
  private readonly assistantToolCalls: Array<Record<string, unknown>> = [];
  private assistantReasoningContent = { present: false, value: "" };
  private systemContent: OpenAiChatContent;

  constructor(
    private readonly input: unknown,
    instructions: unknown,
  ) {
    this.systemContent = readString(instructions) ?? null;
  }

  build = (): Array<Record<string, unknown>> => {
    if (typeof this.input === "string") {
      this.messages.push({
        role: "user",
        content: this.input,
      });
      return this.withSystemMessage();
    }

    for (const rawItem of readArray(this.input)) {
      const item = readRecord(rawItem) as OpenResponsesItemRecord | undefined;
      if (!item) {
        continue;
      }
      this.appendItem(item);
    }

    this.flushAssistant();
    return this.withSystemMessage();
  };

  private appendItem = (item: OpenResponsesItemRecord): void => {
    const type = readString(item.type);
    if (type === "message") {
      this.appendMessageInputItem(item);
    } else if (type === "reasoning") {
      this.appendReasoningItem(item);
    } else if (type === "function_call") {
      this.appendFunctionCallItem(item);
    } else if (type === "function_call_output") {
      this.appendFunctionCallOutputItem(item);
    }
  };

  private appendMessageInputItem = (item: OpenResponsesItemRecord): void => {
    const role = readString(item.role);
    const content = buildChatContent(item.content);
    if (role === "assistant") {
      const text = readAssistantMessageText(content);
      if (text.trim()) {
        this.assistantTextParts.push(text);
      }
      return;
    }

    this.flushAssistant();
    const normalizedRole = role === "developer" ? "system" : role;
    if (normalizedRole === "system") {
      this.systemContent = mergeChatContent(this.systemContent, content);
    } else if (normalizedRole === "user" && content !== null) {
      this.messages.push({
        role: "user",
        content,
      });
    }
  };

  private appendReasoningItem = (item: OpenResponsesItemRecord): void => {
    const content = readArray(item.content);
    const reasoningText = content
      .map((entry) => {
        const record = readRecord(entry);
        if (!record || readString(record.type) !== "reasoning_text") {
          return "";
        }
        return typeof record.text === "string" ? record.text : "";
      })
      .join("");
    this.assistantReasoningContent = { present: true, value: reasoningText };
  };

  private appendFunctionCallItem = (item: OpenResponsesItemRecord): void => {
    const name = readString(item.name);
    const argumentsText = readString(item.arguments) ?? "{}";
    if (!name) {
      return;
    }
    const callId =
      readString(item.call_id) ??
      readString(item.id) ??
      `call_${this.assistantToolCalls.length}`;
    this.assistantToolCalls.push({
      id: callId,
      type: "function",
      function: {
        name,
        arguments: argumentsText,
      },
    });
  };

  private appendFunctionCallOutputItem = (item: OpenResponsesItemRecord): void => {
    this.flushAssistant();
    const callId = readString(item.call_id);
    if (!callId) {
      return;
    }
    this.messages.push({
      role: "tool",
      tool_call_id: callId,
      content: normalizeToolOutput(item.output),
    });
  };

  private flushAssistant = (): void => {
    if (
      this.assistantTextParts.length === 0 &&
      this.assistantToolCalls.length === 0 &&
      !this.assistantReasoningContent.present
    ) {
      return;
    }
    this.messages.push({
      role: "assistant",
      content: this.assistantTextParts.join("\n").trim() || null,
      ...(this.assistantReasoningContent.present
        ? {
            reasoning_content: this.assistantReasoningContent.value,
          }
        : {}),
      ...(this.assistantToolCalls.length > 0
        ? {
            tool_calls: structuredClone(this.assistantToolCalls),
          }
        : {}),
    });
    this.assistantTextParts.length = 0;
    this.assistantToolCalls.length = 0;
    this.assistantReasoningContent = { present: false, value: "" };
  };

  private withSystemMessage = (): Array<Record<string, unknown>> =>
    this.systemContent === null
      ? this.messages
      : [
          {
            role: "system",
            content: this.systemContent,
          },
          ...this.messages,
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
  const { model, request } = buildOpenAiCompatibleUpstreamRequest({
    config: params.config,
    body: params.body,
    stream: false,
  });
  const upstreamResponse = await fetch(request.url, request.init);
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

export function buildOpenAiCompatibleUpstreamRequest(params: {
  config: CodexOpenAiResponsesBridgeConfig;
  body: Record<string, unknown>;
  stream: boolean;
}): {
  model: string;
  request: {
    url: string;
    init: RequestInit;
  };
} {
  const { body, config, stream } = params;
  const model = resolveUpstreamModel(body.model, config);
  const upstreamUrl = new URL(
    "chat/completions",
    withTrailingSlash(config.upstreamApiBase),
  );
  const tools = toOpenAiTools(body.tools);
  const toolChoice = toOpenAiToolChoice(body.tool_choice);
  return {
    model,
    request: {
      url: upstreamUrl.toString(),
      init: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.upstreamApiKey
            ? {
                Authorization: `Bearer ${config.upstreamApiKey}`,
              }
            : {}),
          ...(config.upstreamExtraHeaders ?? {}),
        },
        body: JSON.stringify({
          model,
          messages: buildOpenAiMessages(body.input, body.instructions),
          ...(tools ? { tools } : {}),
          ...(toolChoice ? { tool_choice: toolChoice } : {}),
          ...(config.upstreamReasoningSplit ? { reasoning_split: true } : {}),
          ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
          ...(typeof body.max_output_tokens === "number"
            ? {
                max_tokens: Math.max(
                  1,
                  Math.trunc(readNumber(body.max_output_tokens) ?? 1),
                ),
              }
            : {}),
        }),
      },
    },
  };
}
