import {
  type NcpAgentConversationStateManager,
  type NcpAgentRunInput,
  type NcpAgentRunOptions,
  type NcpAgentRuntime,
  type NcpContextBuilder,
  type NcpEncodeContext,
  type NcpEndpointEvent,
  type NcpLLMApi,
  type NcpLLMApiInput,
  type NcpRoundBuffer,
  type NcpStreamEncoder,
  type NcpToolRegistry,
  NcpEventType,
} from "@nextclaw/ncp";
import { DefaultNcpStreamEncoder } from "./stream-encoder.js";
import { DefaultNcpRoundBuffer } from "./round-buffer.js";
import { appendToolRoundToInput, genId, parseToolArgs } from "./utils.js";

export type DefaultNcpAgentRuntimeConfig = {
  contextBuilder: NcpContextBuilder;
  llmApi: NcpLLMApi;
  toolRegistry: NcpToolRegistry;
  stateManager: NcpAgentConversationStateManager;
  streamEncoder?: NcpStreamEncoder;
};

export class DefaultNcpAgentRuntime implements NcpAgentRuntime {
  private readonly contextBuilder: NcpContextBuilder;
  private readonly llmApi: NcpLLMApi;
  private readonly toolRegistry: NcpToolRegistry;
  private readonly stateManager: NcpAgentConversationStateManager;
  private readonly streamEncoder: NcpStreamEncoder;

  constructor(config: DefaultNcpAgentRuntimeConfig) {
    this.contextBuilder = config.contextBuilder;
    this.llmApi = config.llmApi;
    this.toolRegistry = config.toolRegistry;
    this.stateManager = config.stateManager;
    this.streamEncoder = config.streamEncoder ?? new DefaultNcpStreamEncoder();
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
      const messageSent: NcpEndpointEvent = {
        type: NcpEventType.MessageSent,
        payload: { sessionId: input.sessionId, message: msg },
      };
      await this.stateManager.dispatch(messageSent);
      yield messageSent;
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
  private async *runLoop(
    llmInput: NcpLLMApiInput,
    ctx: NcpEncodeContext,
    options?: NcpAgentRunOptions,
  ): AsyncGenerator<NcpEndpointEvent> {
    const roundBuffer: NcpRoundBuffer = new DefaultNcpRoundBuffer();
    let currentInput = llmInput;
    let done = false;

    while (!done && !options?.signal?.aborted) {
      roundBuffer.clear();

      const stream = this.llmApi.generate(currentInput, { signal: options?.signal });

      for await (const event of this.streamEncoder.encode(stream, ctx)) {
        yield event;

        switch (event.type) {
          case NcpEventType.MessageToolCallStart:
            roundBuffer.startToolCall(event.payload.toolCallId, event.payload.toolName);
            break;
          case NcpEventType.MessageToolCallArgs:
            roundBuffer.appendToolCallArgs(event.payload.args);
            break;
          case NcpEventType.MessageToolCallEnd: {
            const pending = roundBuffer.consumePendingToolCall();
            if (pending) {
              const parsedArgs = parseToolArgs(pending.args);
              const result = await this.toolRegistry.execute(
                pending.toolCallId,
                pending.toolName,
                parsedArgs,
              );
              roundBuffer.appendToolCall({
                toolCallId: pending.toolCallId,
                toolName: pending.toolName,
                args: parsedArgs,
                result,
              });
              yield {
                type: NcpEventType.MessageToolCallResult,
                payload: {
                  sessionId: ctx.sessionId,
                  toolCallId: pending.toolCallId,
                  content: result,
                },
              };
            }
            break;
          }
          case NcpEventType.MessageTextDelta:
            roundBuffer.appendText(event.payload.delta);
            break;
          default:
            break;
        }
      }

      const toolResults = roundBuffer.getToolCalls();
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
        roundBuffer.getText(),
        toolResults,
      );
    }
  }
}
