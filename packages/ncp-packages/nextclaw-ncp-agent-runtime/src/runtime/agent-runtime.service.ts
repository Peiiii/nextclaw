import {
  createNcpEndpointEvent as createRuntimeEvent,
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
import { DefaultNcpStreamEncoder } from "./stream-encoder.service.js";
import {
  appendToolRoundToInput,
  genId,
} from "./runtime.utils.js";
import {
  DefaultNcpRoundCollector,
  type CollectedToolCall,
} from "./round-collector.js";
import { executeCollectedToolCall } from "./utils/tool-call-execution.utils.js";
import {
  defaultToolResultContentManager,
  type ToolResultContentManager,
} from "../tool-result/tool-result-content.manager.js";

type RuntimeEncodeContext = NcpEncodeContext & {
  startedAt: string;
};

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
    const ctxBase: NcpEncodeContext = {
      messageId: genId(),
      runId: (input as NcpAgentRunInput & { runId?: string }).runId ?? genId(),
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
      const messageSent = createRuntimeEvent({
        type: NcpEventType.MessageSent,
        payload: { sessionId: input.sessionId, message: msg },
      });
      await this.stateManager.dispatch(messageSent);
    }

    const startedAt = new Date().toISOString();
    const ctx: RuntimeEncodeContext = { ...ctxBase, startedAt };
    const runStarted = createRuntimeEvent({
      type: NcpEventType.RunStarted,
      payload: {
        sessionId: ctx.sessionId,
        messageId: ctx.messageId,
        runId: ctx.runId,
        startedAt: ctx.startedAt,
      },
    }, ctx.startedAt);
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
    ctx: RuntimeEncodeContext,
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
          await this.executeToolCall(toolCall, ctx),
        );
        toolResults.push(toolResult);
        yield createRuntimeEvent({
          type: NcpEventType.MessageToolCallResult,
          payload: {
            sessionId: ctx.sessionId,
            toolCallId: toolCall.toolCallId,
            content: toolResult.result,
            contentItems: toolResult.contentItems,
          },
        });
      }

      if (toolResults.length === 0) {
        const endedAt = new Date().toISOString();
        yield createRuntimeEvent({
          type: NcpEventType.RunFinished,
          payload: {
            sessionId: ctx.sessionId,
            messageId: ctx.messageId,
            runId: ctx.runId,
            startedAt: ctx.startedAt,
            endedAt,
          },
        }, endedAt);
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
    ctx: RuntimeEncodeContext,
  ): Promise<NcpToolCallResult> {
    return executeCollectedToolCall({
      toolCall,
      tool: this.toolRegistry.getTool(toolCall.toolName),
      execute: async (tool, args) => {
        const updateToolCallResult = async (updatedResult: unknown): Promise<void> => {
          const normalized = this.toolResultContentManager.normalizeToolCallResult({
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.toolName,
            args: typeof args === "object" && args !== null && !Array.isArray(args)
              ? args as Record<string, unknown>
              : null,
            rawArgsText: toolCall.args,
            result: updatedResult,
          });
          await this.stateManager.dispatch(createRuntimeEvent({
            type: NcpEventType.MessageToolCallResult,
            payload: {
              sessionId: ctx.sessionId,
              toolCallId: toolCall.toolCallId,
              content: normalized.result,
              contentItems: normalized.contentItems,
              correlationId: ctx.correlationId,
            },
          }));
        };
        return tool
          ? await tool.execute(args, {
              toolCallId: toolCall.toolCallId,
              updateToolCallResult,
            })
          : undefined;
      },
    });
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
