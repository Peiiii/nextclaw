import type { NcpEndpointEvent } from "./events.js";
import type {
  NcpMessage,
  NcpToolOutputContentItem,
} from "./message.js";

export type NcpAgentRunInput = {
  sessionId: string;
  messages: ReadonlyArray<NcpMessage>;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  executionContext?: NcpAgentRunExecutionContext;
};

export type NcpAgentRunExecutionContext = {
  cwd: string;
};

export type NcpAgentRunOptions = {
  signal?: AbortSignal;
};

export interface NcpAgentRuntime {
  run(
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncIterable<NcpEndpointEvent>;
}

export type NcpContextPrepareOptions = {
  sessionMessages?: ReadonlyArray<NcpMessage>;
  systemPrompt?: string;
  maxMessages?: number;
};

export interface NcpContextBuilder {
  prepare(input: NcpAgentRunInput, options?: NcpContextPrepareOptions): NcpLLMApiInput;
}

export type OpenAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

export type OpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type OpenAIChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | OpenAIContentPart[] }
  | {
      role: "assistant";
      content?: string | null;
      reasoning_content?: string;
      tool_calls?: OpenAIToolCall[];
    }
  | { role: "tool"; content: string; tool_call_id: string };

export type OpenAITool = {
  type: "function";
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
};

export type OpenAIToolCallDelta = {
  index?: number;
  id?: string;
  type?: "function";
  function?: { name?: string; arguments?: string };
};

export type OpenAIChatChunk = {
  id?: string;
  choices?: Array<{
    index?: number;
    delta?: {
      content?: string | null;
      tool_calls?: OpenAIToolCallDelta[];
      reasoning_content?: string;
      reasoning?: string;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export type NcpLLMApiInput = {
  messages: OpenAIChatMessage[];
  tools?: OpenAITool[];
  model?: string;
  thinkingLevel?: string | null;
  max_tokens?: number;
};

export type NcpLLMApiOptions = {
  signal?: AbortSignal;
  temperature?: number;
};

export interface NcpLLMApi {
  generate(
    input: NcpLLMApiInput,
    options?: NcpLLMApiOptions,
  ): AsyncIterable<OpenAIChatChunk>;
}

export type NcpEncodeContext = {
  sessionId: string;
  messageId: string;
  runId: string;
  correlationId?: string;
};

export interface NcpStreamEncoder {
  encode(
    stream: AsyncIterable<OpenAIChatChunk>,
    context: NcpEncodeContext,
  ): AsyncIterable<NcpEndpointEvent>;
}

export type NcpToolDefinition = {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
};

export interface NcpTool {
  readonly name: string;
  readonly description?: string;
  readonly parameters?: Record<string, unknown>;
  validateArgs?(args: Record<string, unknown>): string[];
  execute(args: unknown, context?: NcpToolExecutionContext): Promise<unknown>;
}

export type NcpToolExecutionContext = {
  abortSignal?: AbortSignal;
  toolCallId: string;
  updateToolCallResult?: (result: unknown) => Promise<void>;
};

export type NcpToolCallResult = {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown> | null;
  rawArgsText: string;
  result: unknown;
  contentItems?: NcpToolOutputContentItem[];
};

export type NcpInvalidToolArgumentsResult = {
  ok: false;
  error: {
    code: "invalid_tool_arguments";
    message: string;
    toolCallId: string;
    toolName: string;
    rawArgumentsText: string;
    issues: string[];
  };
};

export interface NcpToolRegistry {
  listTools(): ReadonlyArray<NcpTool>;
  getTool(name: string): NcpTool | undefined;
  getToolDefinitions(): ReadonlyArray<NcpToolDefinition>;
}

export type NcpPendingToolCall = {
  toolCallId: string;
  toolName: string;
  args: unknown;
};

export interface NcpRoundBuffer {
  appendText(delta: string): void;
  getText(): string;
  appendToolCall(result: NcpToolCallResult): void;
  getToolCalls(): ReadonlyArray<NcpToolCallResult>;
  startToolCall(toolCallId: string, toolName: string): void;
  appendToolCallArgs(args: unknown): void;
  consumePendingToolCall(): NcpPendingToolCall | null;
  clear(): void;
}
