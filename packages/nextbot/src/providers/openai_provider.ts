import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { LLMProvider, type LLMResponse, type ToolCallRequest } from "./base.js";
import { findProviderByName } from "./registry.js";

export type OpenAIProviderOptions = {
  apiKey?: string | null;
  apiBase?: string | null;
  defaultModel: string;
  providerName?: string | null;
  extraHeaders?: Record<string, string> | null;
};

export class OpenAICompatibleProvider extends LLMProvider {
  private client: OpenAI;
  private defaultModel: string;
  private providerName?: string | null;
  private extraHeaders?: Record<string, string> | null;

  constructor(options: OpenAIProviderOptions) {
    super(options.apiKey, options.apiBase);
    this.defaultModel = options.defaultModel;
    this.providerName = options.providerName;
    this.extraHeaders = options.extraHeaders ?? null;
    this.client = new OpenAI({
      apiKey: options.apiKey ?? undefined,
      baseURL: options.apiBase ?? undefined,
      defaultHeaders: options.extraHeaders ?? undefined
    });
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async chat(params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMResponse> {
    const model = this.resolveModel(params.model ?? this.defaultModel);
    const { temperature, maxTokens } = this.applyModelOverrides(model, {
      temperature: params.temperature ?? 0.7,
      maxTokens: params.maxTokens ?? 4096
    });

    const response = await this.client.chat.completions.create({
      model,
      messages: params.messages as unknown as ChatCompletionMessageParam[],
      tools: params.tools as ChatCompletionTool[] | undefined,
      tool_choice: params.tools?.length ? "auto" : undefined,
      temperature,
      max_tokens: maxTokens
    });

    const choice = response.choices[0];
    const message = choice?.message;

    const toolCalls: ToolCallRequest[] = [];
    if (message?.tool_calls) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") {
          continue;
        }
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments ?? "{}");
        } catch {
          args = {};
        }
        toolCalls.push({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: args
        });
      }
    }

    const reasoningContent =
      (message as { reasoning_content?: string } | undefined)?.reasoning_content ??
      (message as { reasoning?: string } | undefined)?.reasoning ??
      null;

    return {
      content: message?.content ?? null,
      toolCalls,
      finishReason: choice?.finish_reason ?? "stop",
      usage: {
        prompt_tokens: response.usage?.prompt_tokens ?? 0,
        completion_tokens: response.usage?.completion_tokens ?? 0,
        total_tokens: response.usage?.total_tokens ?? 0
      },
      reasoningContent
    };
  }

  private resolveModel(model: string): string {
    if (!this.providerName) {
      return model;
    }
    const spec = findProviderByName(this.providerName);
    if (!spec) {
      return model;
    }
    let resolved = model;
    if (spec.stripModelPrefix && resolved.includes("/")) {
      resolved = resolved.split("/").slice(-1)[0];
    }
    const skipPrefixes = spec.skipPrefixes ?? [];
    if (spec.litellmPrefix && !skipPrefixes.some((prefix) => resolved.startsWith(prefix))) {
      resolved = `${spec.litellmPrefix}/${resolved}`;
    }
    return resolved;
  }

  private applyModelOverrides(model: string, params: { temperature: number; maxTokens: number }) {
    if (!this.providerName) {
      return params;
    }
    const spec = findProviderByName(this.providerName);
    if (!spec?.modelOverrides) {
      return params;
    }
    const match = spec.modelOverrides.find(([name]) => model.includes(name));
    if (!match) {
      return params;
    }
    const overrides = match[1];
    return {
      temperature: typeof overrides.temperature === "number" ? overrides.temperature : params.temperature,
      maxTokens: typeof overrides.max_tokens === "number" ? overrides.max_tokens : params.maxTokens
    };
  }
}
