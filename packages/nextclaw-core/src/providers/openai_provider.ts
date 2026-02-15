import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { LLMProvider, type LLMResponse, type ToolCallRequest } from "./base.js";

export type OpenAIProviderOptions = {
  apiKey?: string | null;
  apiBase?: string | null;
  defaultModel: string;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
};

export class OpenAICompatibleProvider extends LLMProvider {
  private client: OpenAI;
  private defaultModel: string;
  private extraHeaders?: Record<string, string> | null;
  private wireApi: "auto" | "chat" | "responses";

  constructor(options: OpenAIProviderOptions) {
    super(options.apiKey, options.apiBase);
    this.defaultModel = options.defaultModel;
    this.extraHeaders = options.extraHeaders ?? null;
    this.wireApi = options.wireApi ?? "auto";
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
  }

  private async chatCompletions(params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMResponse> {
    const model = params.model ?? this.defaultModel;
    const temperature = params.temperature ?? 0.7;
    const maxTokens = params.maxTokens ?? 4096;

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

  private async chatResponses(params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    temperature?: number;
  }): Promise<LLMResponse> {
    const model = params.model ?? this.defaultModel;
    const input = this.toResponsesInput(params.messages);
    const body: Record<string, unknown> = { model, input: input as unknown };
    if (params.tools && params.tools.length) {
      body.tools = params.tools as unknown;
    }

    const base = this.apiBase ?? "https://api.openai.com/v1";
    const responseUrl = new URL("responses", base.endsWith("/") ? base : `${base}/`);
    const response = await fetch(responseUrl.toString(), {
      method: "POST",
      headers: {
        "Authorization": this.apiKey ? `Bearer ${this.apiKey}` : "",
        "Content-Type": "application/json",
        ...(this.extraHeaders ?? {})
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Responses API failed (${response.status}): ${text.slice(0, 200)}`);
    }

    const responseAny = (await response.json()) as {
      output?: Array<Record<string, unknown>>;
      usage?: Record<string, number>;
      status?: string;
    };
    const outputItems = responseAny.output ?? [];
    const toolCalls: ToolCallRequest[] = [];
    const contentParts: string[] = [];
    let reasoningContent: string | null = null;

    for (const item of outputItems) {
      const itemAny = item as Record<string, unknown>;
      if (itemAny.type === "reasoning" && Array.isArray(itemAny.summary)) {
        const summaryText = (itemAny.summary as Array<Record<string, unknown> | string>)
          .map((entry) => (typeof entry === "string" ? entry : String((entry as { text?: string }).text ?? "")))
          .filter(Boolean)
          .join("\n");
        reasoningContent = summaryText || reasoningContent;
      }

      if (itemAny.type === "message" && Array.isArray(itemAny.content)) {
        for (const part of itemAny.content as Array<Record<string, unknown>>) {
          const partAny = part as Record<string, unknown>;
          if (partAny?.type === "output_text" || partAny?.type === "text") {
            const text = String(partAny?.text ?? "");
            if (text) {
              contentParts.push(text);
            }
          }
        }
      }

      if (itemAny.type === "tool_call" || itemAny.type === "function_call") {
        const itemFunction = itemAny.function as Record<string, unknown> | undefined;
        const name = String(itemAny.name ?? itemFunction?.name ?? "");
        const rawArgs =
          itemAny.arguments ??
          itemFunction?.arguments ??
          itemAny.input ??
          itemFunction?.input ??
          "{}";
        let args: Record<string, unknown> = {};
        try {
          args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : (rawArgs as Record<string, unknown>);
        } catch {
          args = {};
        }
        toolCalls.push({
          id: String(itemAny.id ?? itemAny.call_id ?? `${name}-${toolCalls.length}`),
          name,
          arguments: args
        });
      }
    }

    const usage = responseAny.usage ?? {};
    return {
      content: contentParts.join("") || null,
      toolCalls,
      finishReason: responseAny.status ?? "stop",
      usage: {
        prompt_tokens: usage.input_tokens ?? usage.prompt_tokens ?? 0,
        completion_tokens: usage.output_tokens ?? usage.completion_tokens ?? 0,
        total_tokens: usage.total_tokens ?? 0
      },
      reasoningContent
    };
  }

  private shouldFallbackToResponses(error: unknown): boolean {
    const err = error as { status?: number; message?: string };
    const status = err?.status;
    const message = err?.message ?? "";
    if (status === 404) {
      return true;
    }
    if (message.includes("Cannot POST") && message.includes("chat/completions")) {
      return true;
    }
    if (message.includes("chat/completions") && message.includes("404")) {
      return true;
    }
    return false;
  }

  private toResponsesInput(messages: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
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

      if (Array.isArray(content) || typeof content === "string") {
        output.content = content;
      } else {
        output.content = String(content ?? "");
      }

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
  }
}
