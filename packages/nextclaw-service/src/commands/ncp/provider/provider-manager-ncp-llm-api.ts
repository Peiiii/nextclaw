import type {
  OpenAIChatChunk,
  OpenAIToolCallDelta,
  NcpLLMApi,
  NcpLLMApiInput,
  NcpLLMApiOptions,
} from "@nextclaw/ncp";
import { parseThinkingLevel, type LLMResponse, type ProviderManager, type ThinkingLevel, type ToolCallRequest } from "@nextclaw/core";

function normalizeModel(value: string | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeThinkingLevel(value: string | null | undefined): ThinkingLevel | null {
  return parseThinkingLevel(value);
}

function normalizeFinishReason(value: string | undefined): string {
  if (typeof value !== "string") {
    return "stop";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "stop";
}

function toToolCallDelta(toolCall: ToolCallRequest, index: number) {
  return {
    index,
    id: toolCall.id,
    type: "function" as const,
    function: {
      name: toolCall.name,
      arguments: JSON.stringify(toolCall.arguments ?? {})
    }
  };
}

function toFinalChunk(
  response: LLMResponse,
  options: {
    includeText: boolean;
    includeReasoning: boolean;
    includeToolCalls: boolean;
  },
): OpenAIChatChunk {
  const delta: NonNullable<OpenAIChatChunk["choices"]>[number]["delta"] = {};
  if (options.includeText && typeof response.content === "string" && response.content.length > 0) {
    delta.content = response.content;
  }
  if (
    options.includeReasoning &&
    typeof response.reasoningContent === "string" &&
    response.reasoningContent.length > 0
  ) {
    delta.reasoning_content = response.reasoningContent;
  }
  if (options.includeToolCalls && response.toolCalls.length > 0) {
    delta.tool_calls = response.toolCalls.map((toolCall, index) => toToolCallDelta(toolCall, index));
  }

  return {
    choices: [
      {
        delta,
        finish_reason: normalizeFinishReason(response.finishReason)
      }
    ],
    usage: response.usage
  };
}

export class ProviderManagerNcpLLMApi implements NcpLLMApi {
  constructor(private readonly providerManager: ProviderManager) {}

  async *generate(input: NcpLLMApiInput, options?: NcpLLMApiOptions): AsyncGenerator<OpenAIChatChunk> {
    const model = normalizeModel(input.model) ?? this.providerManager.get(null).getDefaultModel();
    const thinkingLevel = normalizeThinkingLevel(input.thinkingLevel);
    let sawTextDelta = false;
    let sawReasoningDelta = false;
    let sawToolCallDelta = false;

    for await (const event of this.providerManager.chatStream({
      messages: input.messages as Array<Record<string, unknown>>,
      tools: input.tools as Array<Record<string, unknown>> | undefined,
      model,
      ...(thinkingLevel ? { thinkingLevel } : {}),
      maxTokens: input.max_tokens,
      signal: options?.signal
    })) {
      if (event.type === "delta") {
        sawTextDelta = true;
        yield {
          choices: [
            {
              delta: {
                content: event.delta
              }
            }
          ]
        };
        continue;
      }

      if (event.type === "reasoning_delta") {
        sawReasoningDelta = true;
        yield {
          choices: [
            {
              delta: {
                reasoning_content: event.delta,
              },
            },
          ],
        };
        continue;
      }

      if (event.type === "tool_call_delta") {
        sawToolCallDelta = true;
        yield {
          choices: [
            {
              delta: {
                tool_calls: event.toolCalls as OpenAIToolCallDelta[],
              },
            },
          ],
        };
        continue;
      }

      yield toFinalChunk(event.response, {
        includeText: !sawTextDelta,
        includeReasoning: !sawReasoningDelta,
        includeToolCalls: !sawToolCallDelta,
      });
    }
  }
}
