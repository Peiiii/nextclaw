import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import {
  LLMProvider,
  type LLMResponse,
  type LLMStreamEvent,
  type ProviderChatParams,
} from "./base.provider.js";
import {
  ChatCompletionsPayloadError,
  normalizeChatCompletionsResponse,
  normalizeStructuredUsageCounters
} from "@core/features/llm-providers/index.js";
import { toOpenAiResponsesTools } from "@core/features/llm-providers/utils/openai-responses-tool.utils.js";
import { buildChatCompletionsThinking } from "@core/features/llm-providers/utils/chat-completions-thinking.utils.js";
import {
  buildOpenAiApiBaseCandidates,
  consumeOpenAiChatCompletionsStream,
  consumeOpenAiResponsesStream,
  createEmptyChatCompletionsPayloadError,
  executeOpenAiChatCompletionsStreamRequest,
  executeOpenAiResponsesStreamRequest,
  extractLeadingJson,
  isSemanticallyEmptyOpenAiResponse,
  mapThinkingLevelToOpenAIReasoningEffort,
  mergeOpenAiUsageCounters,
  OpenAiResponsesStreamTerminatedError,
  type ThinkingLevel,
} from "@core/shared/lib/core-utils/index.js";

const STREAM_MAX_ATTEMPTS_BEFORE_OUTPUT = 3;

type ResponsesApiBaseStreamParams = {
  apiBase: string | null;
  body: Record<string, unknown>;
  responseUrl: string;
  signal?: AbortSignal;
};

export type OpenAIProviderOptions = {
  apiKey?: string | null;
  apiBase?: string | null;
  chatCompletionsThinkingControl?: "thinking-type";
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
  private chatCompletionsThinkingControl?: "thinking-type";

  constructor(options: OpenAIProviderOptions) {
    super(options.apiKey, options.apiBase);
    this.defaultModel = options.defaultModel;
    this.chatCompletionsThinkingControl = options.chatCompletionsThinkingControl;
    this.extraHeaders = options.extraHeaders ?? null;
    this.wireApi = options.wireApi ?? "auto";
    this.enableResponsesFallback = options.enableResponsesFallback ?? true;
    this.apiBaseCandidates = buildOpenAiApiBaseCandidates(options.apiBase ?? null);
  }

  getDefaultModel = (): string => {
    return this.defaultModel;
  };

  chat = async (params: ProviderChatParams): Promise<LLMResponse> => {
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

  chatStream = (params: ProviderChatParams): AsyncGenerator<LLMStreamEvent> => {
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

  private chatCompletions = async (params: ProviderChatParams): Promise<LLMResponse> => {
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
            ...buildChatCompletionsThinking({
              control: this.chatCompletionsThinkingControl,
              model,
              thinkingLevel: params.thinkingLevel,
            }),
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

  private chatCompletionsStream = (params: ProviderChatParams): AsyncGenerator<LLMStreamEvent> => {
    return (async function* (provider: OpenAICompatibleProvider): AsyncGenerator<LLMStreamEvent> {
      const model = params.model ?? provider.defaultModel;
      let lastError: unknown = null;

      for (const apiBase of provider.apiBaseCandidates) {
        const base = apiBase ?? "https://api.openai.com/v1";
        const chatCompletionsUrl = new URL("chat/completions", base.endsWith("/") ? base : `${base}/`);

        try {
          const response = await provider.withRetry(() =>
            executeOpenAiChatCompletionsStreamRequest({
              fetchImpl: fetch,
              chatCompletionsUrl: chatCompletionsUrl.toString(),
              apiKey: provider.apiKey,
              extraHeaders: provider.extraHeaders,
              body: {
                model,
                messages: params.messages as unknown as ChatCompletionMessageParam[],
                tools: params.tools as ChatCompletionTool[] | undefined,
                tool_choice: params.tools?.length ? "auto" : undefined,
                ...buildChatCompletionsThinking({
                  control: provider.chatCompletionsThinkingControl,
                  model,
                  thinkingLevel: params.thinkingLevel,
                }),
                ...(typeof params.maxTokens === "number" ? { max_tokens: params.maxTokens } : {}),
              },
              signal: params.signal,
            })
          );

          for await (const event of consumeOpenAiChatCompletionsStream({
            response,
            apiBase,
            mergeUsageCounters: provider.mergeUsageCounters,
            parseToolCallArguments: provider.parseToolCallArguments,
          })) {
            if (event.type === "done" && isSemanticallyEmptyOpenAiResponse(event.response)) {
              throw createEmptyChatCompletionsPayloadError(apiBase);
            }
            yield event;
          }
          return;
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError ?? createEmptyChatCompletionsPayloadError(provider.apiBaseCandidates.at(-1) ?? null);
    })(this);
  };

  private chatResponses = async (params: ProviderChatParams): Promise<LLMResponse> => {
    const { maxTokens, messages, model, thinkingLevel, tools } = params;
    const body = this.buildResponsesRequestBody({
      model: model ?? this.defaultModel,
      messages,
      tools,
      maxTokens,
      thinkingLevel,
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
    params: ProviderChatParams,
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
        const result = yield* provider.streamResponsesFromApiBase({
          apiBase,
          body,
          responseUrl: responseUrl.toString(),
          signal: params.signal,
        });
        if (result.kind === "completed") {
          return;
        }
        lastError = result.error;
      }

      throw lastError ?? new Error("Responses API returned an empty assistant response.");
    })(this);
  };

  private async *streamResponsesFromApiBase(
    { apiBase, body, responseUrl, signal }: ResponsesApiBaseStreamParams,
  ): AsyncGenerator<LLMStreamEvent, { kind: "completed" } | { kind: "failed"; error: unknown }> {
    for (let attempt = 1; attempt <= STREAM_MAX_ATTEMPTS_BEFORE_OUTPUT; attempt += 1) {
      let responseStarted = false;
      let visibleOutputStarted = false;
      try {
        const response = await this.withRetry(() => executeOpenAiResponsesStreamRequest({
          fetchImpl: fetch,
          responseUrl,
          apiKey: this.apiKey,
          extraHeaders: this.extraHeaders,
          body,
          signal,
        }));
        responseStarted = true;
        for await (const event of consumeOpenAiResponsesStream({
          response,
          apiBase,
          normalizeUsageCounters: this.normalizeUsageCounters,
          parseToolCallArguments: this.parseToolCallArguments,
        })) {
          visibleOutputStarted = visibleOutputStarted || event.type !== "done";
          yield event;
        }
        return { kind: "completed" };
      } catch (error) {
        if (visibleOutputStarted) {
          throw error;
        }
        if (
          !responseStarted ||
          attempt >= STREAM_MAX_ATTEMPTS_BEFORE_OUTPUT ||
          !this.isTransientError(error)
        ) {
          return { kind: "failed", error };
        }
        await this.sleep(250 * attempt);
      }
    }

    return { kind: "failed", error: new Error("Retry attempts exhausted") };
  }

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
    const tools = toOpenAiResponsesTools(params.tools);
    if (tools) body.tools = tools;
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
    if (
      code &&
      [
        "ECONNRESET",
        "ETIMEDOUT",
        "EAI_AGAIN",
        "ENOTFOUND",
        "UND_ERR_SOCKET",
        "OPENAI_RESPONSES_STREAM_MISSING_COMPLETED",
      ].includes(code)
    ) {
      return true;
    }

    const message = `${err?.message ?? err?.cause?.message ?? ""}`.toLowerCase();
    return (
      error instanceof OpenAiResponsesStreamTerminatedError ||
      message.includes("fetch failed") ||
      message.includes("overloaded") ||
      message.includes("rate limit") ||
      message.includes("socket hang up") ||
      message.includes("timed out") ||
      message.includes("too many requests") ||
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
        input.push(this.normalizeResponsesToolOutput(msg));
        continue;
      }

      const normalizedContent = this.normalizeResponsesContent(content, role);
      if (normalizedContent.length > 0) {
        input.push({ role, content: normalizedContent });
      }

      input.push(...this.normalizeResponsesToolCalls(msg.tool_calls));
    }

    return input;
  };

  private normalizeResponsesToolOutput = (
    message: Record<string, unknown>
  ): Record<string, unknown> => {
    const content = message.content;
    const output = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? JSON.stringify(content)
        : String(content ?? "");
    return {
      type: "function_call_output",
      call_id: typeof message.tool_call_id === "string" ? message.tool_call_id : "",
      output
    };
  };

  private normalizeResponsesToolCalls = (toolCalls: unknown): Array<Record<string, unknown>> => {
    if (!Array.isArray(toolCalls)) {
      return [];
    }
    const output: Array<Record<string, unknown>> = [];
    for (const call of toolCalls as Array<Record<string, unknown>>) {
      const functionRecord = (call.function as Record<string, unknown> | undefined) ?? {};
      const callId = String(call.id ?? call.call_id ?? "");
      const name = String(functionRecord.name ?? call.name ?? "");
      if (!callId || !name) {
        continue;
      }
      output.push({
        type: "function_call",
        name,
        arguments: String(functionRecord.arguments ?? call.arguments ?? "{}"),
        call_id: callId
      });
    }
    return output;
  };

  private normalizeResponsesContent = (
    content: unknown,
    role: string
  ): Array<Record<string, unknown>> => {
    const textType = role === "assistant" ? "output_text" : "input_text";
    if (typeof content === "string") {
      return content ? [{ type: textType, text: content }] : [];
    }
    if (!Array.isArray(content)) {
      const text = String(content ?? "");
      return text ? [{ type: textType, text }] : [];
    }

    return content
      .map((part) => this.normalizeResponsesContentBlock(part, role, textType))
      .filter((part): part is Record<string, unknown> => part !== null);
  };

  private normalizeResponsesContentBlock = (
    part: unknown,
    role: string,
    textType: "input_text" | "output_text"
  ): Record<string, unknown> | null => {
    if (!part || typeof part !== "object") {
      return null;
    }
    const record = part as Record<string, unknown>;
    const type = String(record.type ?? "");
    if (type === "text" || type === "output_text" || type === "input_text") {
      return typeof record.text === "string" && record.text
        ? { type: textType, text: record.text }
        : null;
    }
    if (role === "assistant" && type === "refusal") {
      return typeof record.refusal === "string" && record.refusal
        ? { type: "refusal", refusal: record.refusal }
        : null;
    }
    if (role !== "user" || (type !== "image_url" && type !== "input_image")) {
      return null;
    }
    const imageUrl = this.readResponsesImageUrl(record.image_url);
    return imageUrl ? { type: "input_image", image_url: imageUrl } : null;
  };

  private readResponsesImageUrl = (value: unknown): string | undefined => {
    if (typeof value === "string") {
      return value;
    }
    if (value && typeof value === "object" && typeof (value as { url?: unknown }).url === "string") {
      return (value as { url: string }).url;
    }
    return undefined;
  };
}
