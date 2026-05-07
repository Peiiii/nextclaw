import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { LLMProvider, type LLMResponse, type LLMStreamEvent } from "./base.js";
import {
  ChatCompletionsPayloadError,
  normalizeChatCompletionsResponse,
  normalizeStructuredUsageCounters
} from "./chat-completions-normalizer.js";
import {
  buildOpenAiApiBaseCandidates,
  createEmptyChatCompletionsPayloadError,
  isSemanticallyEmptyOpenAiResponse,
} from "../utils/openai/response.utils.js";
import { extractLeadingJson } from "../utils/openai/responses-payload.utils.js";
import {
  consumeOpenAiResponsesStream,
  executeOpenAiResponsesStreamRequest,
} from "../utils/openai/responses-stream.utils.js";
import {
  createOpenAiChatCompletionsStreamState,
  consumeOpenAiChatCompletionsChunk,
  finalizeOpenAiChatCompletionsStreamResponse,
  mergeOpenAiUsageCounters,
} from "../utils/openai/stream.utils.js";
import type { ThinkingLevel } from "../utils/thinking.js";
import { mapThinkingLevelToOpenAIReasoningEffort } from "../utils/thinking.js";

export type OpenAIProviderOptions = {
  apiKey?: string | null;
  apiBase?: string | null;
  defaultModel: string;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
  enableResponsesFallback?: boolean;
};

export class OpenAICompatibleProvider extends LLMProvider {
  private clientPool = new Map<string, OpenAI>();
  private defaultModel: string;
  private extraHeaders?: Record<string, string> | null;
  private wireApi: "auto" | "chat" | "responses";
  private enableResponsesFallback: boolean;
  private apiBaseCandidates: Array<string | null>;

  constructor(options: OpenAIProviderOptions) {
    super(options.apiKey, options.apiBase);
    this.defaultModel = options.defaultModel;
    this.extraHeaders = options.extraHeaders ?? null;
    this.wireApi = options.wireApi ?? "auto";
    this.enableResponsesFallback = options.enableResponsesFallback ?? true;
    this.apiBaseCandidates = buildOpenAiApiBaseCandidates(options.apiBase ?? null);
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
    if (this.wireApi === "chat") {
      return this.chatCompletions(params);
    }
    if (this.wireApi === "responses") {
      return this.chatResponses(params);
    }
    try {
      return await this.chatCompletions(params);
    } catch (error) {
      if (this.shouldFallbackToResponses(error)) {
        return await this.chatResponses(params);
      }
      throw error;
    }
  };

  chatStream = (params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    thinkingLevel?: ThinkingLevel | null;
    signal?: AbortSignal;
  }): AsyncGenerator<LLMStreamEvent> => {
    return (async function* (provider: OpenAICompatibleProvider): AsyncGenerator<LLMStreamEvent> {
      if (provider.wireApi === "chat") {
        for await (const event of provider.chatCompletionsStream(params)) {
          yield event;
        }
        return;
      }
      if (provider.wireApi === "responses") {
        for await (const event of provider.chatResponsesStream(params)) {
          yield event;
        }
        return;
      }
      try {
        for await (const event of provider.chatCompletionsStream(params)) {
          yield event;
        }
      } catch (error) {
        if (!provider.shouldFallbackToResponses(error)) {
          throw error;
        }
        for await (const event of provider.chatResponsesStream(params)) {
          yield event;
        }
      }
    })(this);
  };

  private chatCompletions = async (params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    thinkingLevel?: ThinkingLevel | null;
    signal?: AbortSignal;
  }): Promise<LLMResponse> => {
    const model = params.model ?? this.defaultModel;
    let lastError: unknown = null;

    for (const apiBase of this.apiBaseCandidates) {
      try {
        const response = await this.withRetry(async () =>
          this.getClient(apiBase).chat.completions.create({
            model,
            messages: params.messages as unknown as ChatCompletionMessageParam[],
            tools: params.tools as ChatCompletionTool[] | undefined,
            tool_choice: params.tools?.length ? "auto" : undefined,
            ...(typeof params.maxTokens === "number" ? { max_tokens: params.maxTokens } : {})
          }, params.signal ? { signal: params.signal } : undefined)
        );

        const normalized = normalizeChatCompletionsResponse(
          response,
          (raw) => this.parseToolCallArguments(raw)
        );
        if (isSemanticallyEmptyOpenAiResponse(normalized)) {
          throw createEmptyChatCompletionsPayloadError(apiBase);
        }
        return normalized;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? createEmptyChatCompletionsPayloadError(this.apiBaseCandidates.at(-1) ?? null);
  };

  private chatCompletionsStream = (params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    thinkingLevel?: ThinkingLevel | null;
    signal?: AbortSignal;
  }): AsyncGenerator<LLMStreamEvent> => {
    return (async function* (provider: OpenAICompatibleProvider): AsyncGenerator<LLMStreamEvent> {
      const model = params.model ?? provider.defaultModel;
      let lastError: unknown = null;

      for (const apiBase of provider.apiBaseCandidates) {
        try {
          const stream = await provider.withRetry(async () =>
            provider.getClient(apiBase).chat.completions.create({
              model,
              messages: params.messages as unknown as ChatCompletionMessageParam[],
              tools: params.tools as ChatCompletionTool[] | undefined,
              tool_choice: params.tools?.length ? "auto" : undefined,
              ...(typeof params.maxTokens === "number" ? { max_tokens: params.maxTokens } : {}),
              stream: true,
              stream_options: {
                include_usage: true
              }
            }, params.signal ? { signal: params.signal } : undefined)
          );
          const state = createOpenAiChatCompletionsStreamState();

          for await (const chunk of stream) {
            for (const event of consumeOpenAiChatCompletionsChunk({
              chunk: chunk as unknown as Record<string, unknown>,
              state,
              mergeUsageCounters: provider.mergeUsageCounters,
            })) {
              yield event;
            }
          }

          const response = finalizeOpenAiChatCompletionsStreamResponse({
            state,
            parseToolCallArguments: provider.parseToolCallArguments,
          });
          if (isSemanticallyEmptyOpenAiResponse(response)) {
            throw createEmptyChatCompletionsPayloadError(apiBase);
          }

          yield {
            type: "done",
            response
          };
          return;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError ?? createEmptyChatCompletionsPayloadError(provider.apiBaseCandidates.at(-1) ?? null);
    })(this);
  };

  private chatResponses = async (params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    thinkingLevel?: ThinkingLevel | null;
    signal?: AbortSignal;
  }): Promise<LLMResponse> => {
    const body = this.buildResponsesRequestBody({
      model: params.model ?? this.defaultModel,
      messages: params.messages,
      tools: params.tools,
      maxTokens: params.maxTokens,
      thinkingLevel: params.thinkingLevel,
    });

    let finalResponse: LLMResponse | null = null;
    for await (const event of this.chatResponsesStream(params, body)) {
      if (event.type === "done") {
        finalResponse = event.response;
      }
    }
    if (finalResponse) {
      return finalResponse;
    }

    throw new Error("Responses API returned an empty assistant response.");
  };

  private chatResponsesStream = (
    params: {
      messages: Array<Record<string, unknown>>;
      tools?: Array<Record<string, unknown>>;
      model?: string | null;
      maxTokens?: number;
      thinkingLevel?: ThinkingLevel | null;
      signal?: AbortSignal;
    },
    preparedBody?: Record<string, unknown>,
  ): AsyncGenerator<LLMStreamEvent> => {
    return (async function* (provider: OpenAICompatibleProvider): AsyncGenerator<LLMStreamEvent> {
      const model = params.model ?? provider.defaultModel;
      const body = preparedBody ?? provider.buildResponsesRequestBody({
        model,
        messages: params.messages,
        tools: params.tools,
        maxTokens: params.maxTokens,
        thinkingLevel: params.thinkingLevel,
      });
      let lastError: unknown = null;

      for (const apiBase of provider.apiBaseCandidates) {
        const base = apiBase ?? "https://api.openai.com/v1";
        const responseUrl = new URL("responses", base.endsWith("/") ? base : `${base}/`);

        try {
          const response = await provider.withRetry(() => executeOpenAiResponsesStreamRequest({
            fetchImpl: fetch,
            responseUrl: responseUrl.toString(),
            apiKey: provider.apiKey,
            extraHeaders: provider.extraHeaders,
            body,
            signal: params.signal,
          }));
          for await (const event of consumeOpenAiResponsesStream({
            response,
            apiBase,
            normalizeUsageCounters: provider.normalizeUsageCounters,
            parseToolCallArguments: provider.parseToolCallArguments,
          })) {
            yield event;
          }
          return;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError ?? new Error("Responses API returned an empty assistant response.");
    })(this);
  };

  private buildResponsesRequestBody = (params: {
    model: string;
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    maxTokens?: number;
    thinkingLevel?: ThinkingLevel | null;
  }): Record<string, unknown> => {
    const input = this.toResponsesInput(params.messages);
    const body: Record<string, unknown> = { model: params.model, input: input as unknown };
    const reasoningEffort = mapThinkingLevelToOpenAIReasoningEffort(params.thinkingLevel);
    if (reasoningEffort) {
      body.reasoning = { effort: reasoningEffort };
    }
    if (params.tools && params.tools.length) {
      body.tools = params.tools as unknown;
    }
    if (typeof params.maxTokens === "number") {
      body.max_output_tokens = params.maxTokens;
    }
    return body;
  };

  private shouldFallbackToResponses = (error: unknown): boolean => {
    if (!this.enableResponsesFallback) return false;
    const err = error as { status?: number; message?: string; code?: string };
    const status = err?.status;
    const message = err?.message ?? "";
    const code = err?.code ?? (error instanceof ChatCompletionsPayloadError ? error.code : "");
    if (status === 404) {
      return true;
    }
    if (code === "INVALID_CHAT_COMPLETIONS_PAYLOAD") {
      return true;
    }
    if (message.includes("Cannot POST") && message.includes("chat/completions")) {
      return true;
    }
    if (message.includes("chat/completions") && message.includes("404")) {
      return true;
    }
    return false;
  };

  private parseToolCallArguments = (raw: unknown): Record<string, unknown> => {
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, unknown>;
    }

    if (typeof raw !== "string") {
      return {};
    }

    const trimmed = raw.trim();
    if (!trimmed) {
      return {};
    }

    const candidates = [trimmed, this.stripCodeFence(trimmed), extractLeadingJson(trimmed)].filter(
      (value): value is string => Boolean(value)
    );

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // continue trying next candidate
      }
    }

    return {};
  };

  private stripCodeFence = (text: string): string => {
    const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fence?.[1]?.trim() ?? text;
  };

  private normalizeUsageCounters = (raw: Record<string, unknown> | undefined): Record<string, number> => {
    return normalizeStructuredUsageCounters(raw, {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    });
  };

  private mergeUsageCounters = (
    current: Record<string, number>,
    incoming: Record<string, unknown>
  ): Record<string, number> => {
    return mergeOpenAiUsageCounters(current, incoming);
  };

  private withRetry = async <T>(operation: () => Promise<T>): Promise<T> => {
    const maxAttempts = 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        return await operation();
      } catch (error) {
        if (attempt >= maxAttempts || !this.isTransientError(error)) {
          throw error;
        }
        await this.sleep(250 * attempt);
      }
    }

    throw new Error("Retry attempts exhausted");
  };

  private isTransientError = (error: unknown): boolean => {
    const err = error as {
      status?: number;
      code?: string;
      message?: string;
      cause?: { code?: string; message?: string };
    };
    const status = err?.status;
    if (typeof status === "number" && (status === 429 || status >= 500)) {
      return true;
    }

    const code = `${err?.code ?? err?.cause?.code ?? ""}`.toUpperCase();
    if (code && ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "UND_ERR_SOCKET"].includes(code)) {
      return true;
    }

    const message = `${err?.message ?? err?.cause?.message ?? ""}`.toLowerCase();
    return (
      message.includes("fetch failed") ||
      message.includes("socket hang up") ||
      message.includes("timed out") ||
      message.includes("temporarily unavailable")
    );
  };

  private sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  private getClient = (apiBase: string | null): OpenAI => {
    const key = apiBase?.trim() || "__default__";
    const existing = this.clientPool.get(key);
    if (existing) {
      return existing;
    }

    const created = new OpenAI({
      apiKey: this.apiKey ?? undefined,
      baseURL: apiBase ?? undefined,
      defaultHeaders: this.extraHeaders ?? undefined
    });
    this.clientPool.set(key, created);
    return created;
  };

  private toResponsesInput = (messages: Array<Record<string, unknown>>): Array<Record<string, unknown>> => {
    const input: Array<Record<string, unknown>> = [];
    for (const msg of messages) {
      const role = String(msg.role ?? "user");
      const content = msg.content;
      if (role === "tool") {
        const callId = typeof msg.tool_call_id === "string" ? msg.tool_call_id : "";
        const outputText =
          typeof content === "string"
            ? content
            : Array.isArray(content)
              ? JSON.stringify(content)
              : String(content ?? "");
        input.push({
          type: "function_call_output",
          call_id: callId,
          output: outputText
        });
        continue;
      }

      const output: Record<string, unknown> = { role };
      output.content = this.normalizeResponsesContent(content);

      if (typeof msg.reasoning_content === "string" && msg.reasoning_content) {
        output.reasoning = msg.reasoning_content;
      }

      input.push(output);

      if (Array.isArray(msg.tool_calls)) {
        for (const call of msg.tool_calls as Array<Record<string, unknown>>) {
          const callAny = call as Record<string, unknown>;
          const functionAny = (callAny.function as Record<string, unknown> | undefined) ?? {};
          const callId = String(callAny.id ?? callAny.call_id ?? "");
          const name = String(functionAny.name ?? callAny.name ?? "");
          const args = String(functionAny.arguments ?? callAny.arguments ?? "{}");
          if (!callId || !name) {
            continue;
          }
          input.push({
            type: "function_call",
            name,
            arguments: args,
            call_id: callId
          });
        }
      }
    }

    return input;
  };

  private normalizeResponsesContent = (content: unknown): string | Array<Record<string, unknown>> => {
    if (typeof content === "string") {
      return [{ type: "input_text", text: content }];
    }
    if (!Array.isArray(content)) {
      return String(content ?? "");
    }

    const blocks: Array<Record<string, unknown>> = [];
    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }
      const partAny = part as Record<string, unknown>;
      const type = String(partAny.type ?? "");
      if (type === "text" || type === "output_text" || type === "input_text") {
        const textValue = typeof partAny.text === "string" ? partAny.text : "";
        if (textValue) {
          blocks.push({ type: "input_text", text: textValue });
        }
        continue;
      }
      if (type === "image_url" || type === "input_image") {
        const imageValue = partAny.image_url as string | { url?: string } | undefined;
        const imageUrl =
          typeof imageValue === "string"
            ? imageValue
            : imageValue && typeof imageValue === "object" && typeof imageValue.url === "string"
              ? imageValue.url
              : undefined;
        if (imageUrl) {
          blocks.push({ type: "input_image", image_url: imageUrl });
        }
      }
    }

    if (blocks.length > 0) {
      return blocks;
    }
    return String(content ?? "");
  };
}
