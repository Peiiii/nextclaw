import {
  type NcpAssistantReasoningNormalizationMode,
  type NcpAgentConversationStateManager,
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpContextBuilder,
  type NcpEncodeContext,
  type NcpEndpointEvent,
  type NcpLLMApi,
  type NcpLLMApiInput,
  type NcpToolCallResult,
  type NcpStreamEncoder,
  type NcpToolRegistry,
  type OpenAIChatChunk,
  isHiddenNcpMessage,
  NcpEventType,
} from "@nextclaw/ncp";
import { DefaultNcpStreamEncoder } from "./stream-encoder.js";
import {
  appendToolRoundToInput,
  createInvalidToolArgumentsResult,
  createToolExecutionFailedResult,
  genId,
  parseToolArgs,
  validateToolArgs,
} from "./utils.js";
import {
  DefaultNcpRoundCollector,
  type CollectedToolCall,
} from "./round-collector.js";
import {
  defaultToolResultContentManager,
  type ToolResultContentManager,
} from "./tool-result-content.manager.js";

export type DefaultNcpAgentRuntimeConfig = {
  contextBuilder: NcpContextBuilder;
  llmApi: NcpLLMApi;
  toolRegistry: NcpToolRegistry;
  stateManager: NcpAgentConversationStateManager;
  streamEncoder?: NcpStreamEncoder;
  reasoningNormalizationMode?: NcpAssistantReasoningNormalizationMode;
  toolResultContentManager?: ToolResultContentManager;
};

export class DefaultNcpAgentRuntime implements NcpAgentRuntime {
  private readonly contextBuilder: NcpContextBuilder;
  private readonly llmApi: NcpLLMApi;
  private readonly toolRegistry: NcpToolRegistry;
  private readonly stateManager: NcpAgentConversationStateManager;
  private readonly streamEncoder: NcpStreamEncoder;
  private readonly reasoningNormalizationMode: NcpAssistantReasoningNormalizationMode;
  private readonly toolResultContentManager: ToolResultContentManager;

  constructor(config: DefaultNcpAgentRuntimeConfig) {
    this.contextBuilder = config.contextBuilder;
    this.llmApi = config.llmApi;
    this.toolRegistry = config.toolRegistry;
    this.stateManager = config.stateManager;
    this.reasoningNormalizationMode = config.reasoningNormalizationMode ?? "off";
    this.toolResultContentManager =
      config.toolResultContentManager ?? defaultToolResultContentManager;
    this.streamEncoder =
      config.streamEncoder ??
      new DefaultNcpStreamEncoder({
        reasoningNormalizationMode: this.reasoningNormalizationMode,
      });
  }

  run = async function* (
    this: DefaultNcpAgentRuntime,
    input: NcpAgentRunInput,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const ctx: NcpEncodeContext = {
      messageId: genId(),
      runId: genId(),
      sessionId: input.sessionId,
      correlationId: input.correlationId,
    };

    const sessionMessages = this.stateManager.getSnapshot().messages;
    const modelInput = this.contextBuilder.prepare(input, {
      sessionMessages,
    });

    for (const msg of input.messages) {
      if (isHiddenNcpMessage(msg)) {
        continue;
      }
      const messageSent: NcpEndpointEvent = {
        type: NcpEventType.MessageSent,
        payload: { sessionId: input.sessionId, message: msg },
      };
      await this.stateManager.dispatch(messageSent);
    }

    const runStarted: NcpEndpointEvent = {
      type: NcpEventType.RunStarted,
      payload: { sessionId: ctx.sessionId, messageId: ctx.messageId, runId: ctx.runId },
    };
    await this.stateManager.dispatch(runStarted);
    yield runStarted;

    for await (const event of this.runLoop(modelInput, ctx, options)) {
      await this.stateManager.dispatch(event);
      yield event;
    }
  };

  /**
   * Agent loop: LLM stream → encoder events → tool execution (if any) → next round or finish.
   * RunFinished is emitted only when the entire loop completes (no more tool calls).
   * The stream encoder does not emit RunFinished; it only converts chunks to NCP events.
   */
  private runLoop = async function* (
    this: DefaultNcpAgentRuntime,
    llmInput: NcpLLMApiInput,
    ctx: NcpEncodeContext,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const roundCollector = new DefaultNcpRoundCollector(this.reasoningNormalizationMode);
    let currentInput = llmInput;
    let done = false;

    while (!done && !options?.signal?.aborted) {
      roundCollector.clear();

      const stream = this.llmApi.generate(currentInput, { signal: options?.signal });
      const tappedStream = this.tapStream(stream, (chunk) => roundCollector.consumeChunk(chunk));

      for await (const event of this.streamEncoder.encode(tappedStream, ctx)) {
        yield event;
      }

      const toolResults: NcpToolCallResult[] = [];
      for (const toolCall of roundCollector.getToolCalls()) {
        const toolResult = this.toolResultContentManager.normalizeToolCallResult(
          await this.executeToolCall(toolCall),
        );
        toolResults.push(toolResult);
        yield {
          type: NcpEventType.MessageToolCallResult,
          payload: {
            sessionId: ctx.sessionId,
            toolCallId: toolCall.toolCallId,
            content: toolResult.result,
            contentItems: toolResult.contentItems,
          },
        };
      }

      if (toolResults.length === 0) {
        yield {
          type: NcpEventType.RunFinished,
          payload: { sessionId: ctx.sessionId, messageId: ctx.messageId, runId: ctx.runId },
        };
        done = true;
        break;
      }

      currentInput = appendToolRoundToInput(
        currentInput,
        roundCollector.getReasoning(),
        roundCollector.getText(),
        toolResults,
        this.toolResultContentManager,
      );
    }
  };

  private executeToolCall = async function (
    this: DefaultNcpAgentRuntime,
    toolCall: CollectedToolCall,
  ): Promise<NcpToolCallResult> {
    const tool = this.toolRegistry.getTool(toolCall.toolName);
    const parsedArgs = parseToolArgs(toolCall.args);
    if (!parsedArgs.ok) {
      return {
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        args: null,
        rawArgsText: parsedArgs.rawText,
        result: createInvalidToolArgumentsResult({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          rawArgumentsText: parsedArgs.rawText,
          issues: parsedArgs.issues,
        }),
      };
    }

    const validationIssues = this.resolveValidationIssues(parsedArgs.value, tool);
    if (validationIssues.length > 0) {
      return {
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        args: null,
        rawArgsText: parsedArgs.rawText,
        result: createInvalidToolArgumentsResult({
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          rawArgumentsText: parsedArgs.rawText,
          issues: validationIssues,
        }),
      };
    }

    return {
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      args: parsedArgs.value,
      rawArgsText: parsedArgs.rawText,
      result: await this.executeValidatedToolCall(toolCall, parsedArgs.value),
    };
  };

  private resolveValidationIssues = function (
    this: DefaultNcpAgentRuntime,
    args: Record<string, unknown>,
    tool: ReturnType<NcpToolRegistry["getTool"]>,
  ): string[] {
    const schemaIssues = validateToolArgs(args, tool?.parameters);
    if (schemaIssues.length > 0) {
      return schemaIssues;
    }
    return typeof tool?.validateArgs === "function" ? tool.validateArgs(args) : [];
  };

  private executeValidatedToolCall = async function (
    this: DefaultNcpAgentRuntime,
    toolCall: CollectedToolCall,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    try {
      return await this.toolRegistry.execute(
        toolCall.toolCallId,
        toolCall.toolName,
        args,
      );
    } catch (error) {
      return createToolExecutionFailedResult({
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        error,
      });
    }
  };

  private tapStream = async function* (
    this: DefaultNcpAgentRuntime,
    stream: AsyncIterable<OpenAIChatChunk>,
    onChunk: (chunk: OpenAIChatChunk) => void,
  ): AsyncGenerator<OpenAIChatChunk> {
    for await (const chunk of stream) {
      onChunk(chunk);
      yield chunk;
    }
  };
}
