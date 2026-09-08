import {
  sanitizeAssistantReplyTags,
  type NcpMessage,
  type NcpMessagePart,
  type NcpToolOutputContentItem,
  type OpenAIChatMessage,
} from "@nextclaw/ncp";
import type { LocalAssetStore } from "../../assets/stores/local-asset.store.js";
import {
  defaultToolResultContentManager,
  type ToolResultContentManager,
} from "../../tool-result/tool-result-content.manager.js";
import { buildNcpUserContent } from "../user-content.utils.js";

export type NcpMessageToOpenAiMessagesOptions = {
  assetStore?: LocalAssetStore | null;
  toolResultContentManager?: ToolResultContentManager;
};

/** Original part boundaries between model calls within one persisted UI message. */
export const MODEL_ROUND_PART_OFFSETS = "model_round_part_offsets";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

function isTextLikePart(part: NcpMessagePart): part is Extract<NcpMessagePart, { type: "text" | "rich-text" }> {
  return part.type === "text" || part.type === "rich-text";
}

const readText = (parts: readonly NcpMessagePart[]): string =>
  parts.filter(isTextLikePart).map((part) => part.text).join("");

export function ncpMessageToOpenAiMessages(
  rawMessage: NcpMessage,
  options: NcpMessageToOpenAiMessagesOptions = {},
): OpenAIChatMessage[] {
  return ncpMessageToOpenAiMessageGroups(rawMessage, options).flatMap((group) => group.messages);
}

/** Keeps the persisted part coordinate for compaction consumers selecting a model-round tail. */
export function ncpMessageToOpenAiMessageGroups(
  rawMessage: NcpMessage,
  options: NcpMessageToOpenAiMessagesOptions = {},
): Array<{ partStart: number; messages: OpenAIChatMessage[] }> {
  const offsets = rawMessage.metadata?.[MODEL_ROUND_PART_OFFSETS];
  if (rawMessage.role === "assistant" && offsets !== undefined) {
    if (!Array.isArray(offsets) || offsets.some((offset, index) =>
      !Number.isInteger(offset) || offset <= 0 || offset > rawMessage.parts.length ||
      (index > 0 && offset <= offsets[index - 1])
    )) {
      throw new Error("Invalid assistant model round part offsets");
    }
    const boundaries = [0, ...offsets, rawMessage.parts.length];
    return boundaries.slice(0, -1).flatMap((start, index) => {
      const parts = rawMessage.parts.slice(start, boundaries[index + 1]);
      return parts.length === 0 ? [] : [{ partStart: start,
        messages: convertModelRound({ ...rawMessage, parts }, options) }];
    });
  }
  return [{ partStart: 0, messages: convertModelRound(rawMessage, options) }];
}

function convertModelRound(
  rawMessage: NcpMessage,
  options: NcpMessageToOpenAiMessagesOptions,
): OpenAIChatMessage[] {
  const message =
    rawMessage.role === "assistant" ? sanitizeAssistantReplyTags(rawMessage) : rawMessage;
  const parts = message.parts ?? [];

  if (message.role === "user") {
    return [
      {
        role: "user",
        content: buildNcpUserContent(parts, {
          assetStore: options.assetStore,
        }),
      },
    ];
  }

  if (message.role === "system" || message.role === "service") {
    return [{ role: "system", content: readText(parts) }];
  }

  if (message.role === "tool") {
    return [
      {
        role: "tool",
        content: readText(parts),
        tool_call_id: message.id,
      },
    ];
  }

  if (message.role !== "assistant") {
    return [];
  }

  const texts: string[] = [];
  const reasonings: string[] = [];
  const toolInvocations: Array<{
    toolCallId: string;
    toolName: string;
    args: unknown;
    result: unknown;
    resultContentItems?: NcpToolOutputContentItem[];
  }> = [];

  for (const part of parts) {
    if (part.type === "reasoning") {
      reasonings.push(part.text);
    }
    if (part.type === "text") {
      texts.push(part.text);
    }
    if (part.type === "tool-invocation" && part.state === "result" && part.result !== undefined) {
      toolInvocations.push({
        toolCallId: part.toolCallId ?? "",
        toolName: part.toolName,
        args: part.args ?? {},
        result: part.result,
        resultContentItems: part.resultContentItems,
      });
    }
  }

  const text = texts.join("");
  const reasoning = reasonings.join("");
  const toolResultContentManager =
    options.toolResultContentManager ?? defaultToolResultContentManager;

  if (toolInvocations.length === 0) {
    return [
      {
        role: "assistant",
        content: text,
        ...(reasoning ? { reasoning_content: reasoning } : {}),
      },
    ];
  }

  return [
    {
      role: "assistant",
      content: text || null,
      ...(reasoning ? { reasoning_content: reasoning } : {}),
      tool_calls: toolInvocations.map((toolInvocation) => ({
        id: toolInvocation.toolCallId,
        type: "function" as const,
        function: {
          name: toolInvocation.toolName,
          arguments:
            typeof toolInvocation.args === "string"
              ? toolInvocation.args
              : JSON.stringify(toolInvocation.args ?? {}),
        },
      })),
    },
    ...toolInvocations.map((toolInvocation): OpenAIChatMessage => ({
      role: "tool",
      content: toolResultContentManager.toModelContent(toolInvocation.result, {
        toolCallId: toolInvocation.toolCallId,
        toolName: toolInvocation.toolName,
      }),
      tool_call_id: toolInvocation.toolCallId,
    })),
    ...(message.status !== "final"
      ? toolResultContentManager.toVisualObservationMessages(
          toolInvocations.map((toolInvocation) => ({
            toolCallId: toolInvocation.toolCallId,
            toolName: toolInvocation.toolName,
            args: isRecord(toolInvocation.args)
              ? (toolInvocation.args as Record<string, unknown>)
              : null,
            rawArgsText:
              typeof toolInvocation.args === "string"
                ? toolInvocation.args
                : JSON.stringify(toolInvocation.args ?? {}),
            result: toolInvocation.result,
            contentItems: toolInvocation.resultContentItems,
          })),
        )
      : []),
  ];
}
