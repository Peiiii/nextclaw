import type { NcpMessage } from "@nextclaw/ncp";
import type {
  NcpContextBuilder,
  NcpContextPrepareOptions,
  NcpLLMApiInput,
  NcpMessagePart,
  OpenAIChatMessage,
  OpenAITool,
} from "@nextclaw/ncp";
import type { NcpAgentRunInput } from "@nextclaw/ncp";
import type { NcpToolRegistry } from "@nextclaw/ncp";
import type { LocalAssetStore } from "./asset-store.js";
import { buildNcpUserContent } from "./user-content.js";
import { buildOpenAiFunctionTool } from "./utils.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isTextLikePart(part: NcpMessagePart): part is Extract<NcpMessagePart, { type: "text" | "rich-text" }> {
  return part.type === "text" || part.type === "rich-text";
}

function mergeMessageAndRequestMetadata(input: NcpAgentRunInput): Record<string, unknown> {
  const messageMetadata = input.messages
    .slice()
    .reverse()
    .find((message) => isRecord(message.metadata))?.metadata;
  return {
    ...(isRecord(messageMetadata) ? messageMetadata : {}),
    ...(isRecord(input.metadata) ? input.metadata : {}),
  };
}

function readRequestedToolNames(metadata: Record<string, unknown>): string[] {
  const raw =
    metadata.requested_tools ??
    metadata.requestedTools ??
    metadata.requested_skills ??
    metadata.requestedSkills;
  if (!Array.isArray(raw)) {
    return [];
  }
  const deduped = new Set<string>();
  for (const item of raw) {
    const value = readOptionalString(item);
    if (value) {
      deduped.add(value);
    }
  }
  return [...deduped];
}

type DefaultNcpContextBuilderOptions = {
  toolRegistry?: NcpToolRegistry;
  assetStore?: LocalAssetStore | null;
};

function isDefaultNcpContextBuilderOptions(
  value: NcpToolRegistry | DefaultNcpContextBuilderOptions | undefined,
): value is DefaultNcpContextBuilderOptions {
  return Boolean(value) && typeof value === "object" && !("getToolDefinitions" in value);
}

function messageToOpenAI(
  msg: NcpMessage,
  options: {
    assetStore?: LocalAssetStore | null;
  },
): OpenAIChatMessage[] {
  const role = msg.role as "user" | "assistant" | "system" | "tool";
  const parts = msg.parts ?? [];

  if (role === "user" || role === "system") {
    if (role === "user") {
      return [
        {
          role,
          content: buildNcpUserContent(parts, {
            assetStore: options.assetStore,
          }),
        },
      ];
    }
    const text = parts.filter(isTextLikePart).map((part) => part.text).join("");
    return [{ role, content: text }];
  }

  if (role === "assistant") {
    const texts: string[] = [];
    const reasonings: string[] = [];
    const toolInvocations: Array<{
      toolCallId: string;
      toolName: string;
      args: unknown;
      result: unknown;
    }> = [];

    for (const p of parts) {
      if (p.type === "reasoning") {
        reasonings.push(p.text);
      }
      if (p.type === "text") {
        texts.push(p.text);
      }
      if (p.type === "tool-invocation" && p.state === "result" && p.result !== undefined) {
        toolInvocations.push({
          toolCallId: p.toolCallId ?? "",
          toolName: p.toolName,
          args: p.args ?? {},
          result: p.result,
        });
      }
    }

    const text = texts.join("");
    const reasoning = reasonings.join("");
    const out: OpenAIChatMessage[] = [];

    if (toolInvocations.length > 0) {
      out.push({
        role: "assistant",
        content: text || null,
        ...(reasoning ? { reasoning_content: reasoning } : {}),
        tool_calls: toolInvocations.map((t) => ({
          id: t.toolCallId,
          type: "function" as const,
          function: {
            name: t.toolName,
            arguments:
              typeof t.args === "string" ? t.args : JSON.stringify(t.args ?? {}),
          },
        })),
      });
      for (const t of toolInvocations) {
        out.push({
          role: "tool",
          content: typeof t.result === "string" ? t.result : JSON.stringify(t.result),
          tool_call_id: t.toolCallId,
        });
      }
    } else {
      out.push({
        role: "assistant",
        content: text,
        ...(reasoning ? { reasoning_content: reasoning } : {}),
      });
    }
    return out;
  }

  return [];
}

export class DefaultNcpContextBuilder implements NcpContextBuilder {
  private readonly toolRegistry?: NcpToolRegistry;
  private readonly assetStore?: LocalAssetStore | null;

  constructor(toolRegistry?: NcpToolRegistry);
  constructor(options?: DefaultNcpContextBuilderOptions);
  constructor(toolRegistryOrOptions?: NcpToolRegistry | DefaultNcpContextBuilderOptions) {
    if (isDefaultNcpContextBuilderOptions(toolRegistryOrOptions)) {
      this.toolRegistry = toolRegistryOrOptions.toolRegistry;
      this.assetStore = toolRegistryOrOptions.assetStore;
      return;
    }
    this.toolRegistry = toolRegistryOrOptions;
  }

  prepare = (
    input: NcpAgentRunInput,
    options?: NcpContextPrepareOptions,
  ): NcpLLMApiInput => {
    const maxMessages = options?.maxMessages ?? 50;
    const sessionMessages = options?.sessionMessages ?? [];
    const systemPrompt = options?.systemPrompt;

    const requestMetadata = mergeMessageAndRequestMetadata(input);
    const requestedToolNames = readRequestedToolNames(requestMetadata);

    const messages: OpenAIChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    for (const msg of sessionMessages.slice(-maxMessages)) {
      messages.push(
        ...messageToOpenAI(msg, {
          assetStore: this.assetStore,
        }),
      );
    }

    for (const msg of input.messages) {
      messages.push(
        ...messageToOpenAI(msg, {
          assetStore: this.assetStore,
        }),
      );
    }

    const toolDefinitions = this.toolRegistry?.getToolDefinitions() ?? [];
    const filteredToolDefinitions =
      requestedToolNames.length > 0
        ? toolDefinitions.filter((definition) => requestedToolNames.includes(definition.name))
        : toolDefinitions;
    const tools: OpenAITool[] | undefined = filteredToolDefinitions.map(buildOpenAiFunctionTool);

    return {
      messages,
      tools: tools && tools.length > 0 ? tools : undefined,
      model:
        readOptionalString(requestMetadata.model) ??
        readOptionalString(requestMetadata.llm_model) ??
        readOptionalString(requestMetadata.agent_model) ??
        undefined,
      thinkingLevel:
        readOptionalString(requestMetadata.thinking) ??
        readOptionalString(requestMetadata.thinking_level) ??
        readOptionalString(requestMetadata.thinkingLevel) ??
        readOptionalString(requestMetadata.thinking_effort) ??
        readOptionalString(requestMetadata.thinkingEffort) ??
        null,
    };
  };
}
