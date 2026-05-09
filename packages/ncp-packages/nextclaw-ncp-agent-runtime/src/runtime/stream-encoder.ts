import {
  type NcpAssistantReasoningNormalizationMode,
  type NcpEncodeContext,
  type NcpEndpointEvent,
  type NcpStreamEncoder,
  type OpenAIChatChunk,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  closeTextPartBeforeToolCalls,
  createStreamContentState,
  type DeltaLike,
  emitReasoningDelta,
  emitTextDeltas,
  emitToolCallDeltas,
  flushTextDeltas,
  flushToolCalls,
  type ToolCallBuffer,
} from "./stream-encoder.utils.js";

export type DefaultNcpStreamEncoderConfig = {
  reasoningNormalizationMode?: NcpAssistantReasoningNormalizationMode;
};

/**
 * Converts LLM stream chunks to NCP events (text, reasoning, tool calls).
 * Does not emit RunFinished; that is the runtime's responsibility after the loop completes.
 */
export class DefaultNcpStreamEncoder implements NcpStreamEncoder {
  private readonly reasoningNormalizationMode: NcpAssistantReasoningNormalizationMode;

  constructor(config: DefaultNcpStreamEncoderConfig = {}) {
    this.reasoningNormalizationMode = config.reasoningNormalizationMode ?? "off";
  }

  async *encode(
    stream: AsyncIterable<OpenAIChatChunk>,
    context: NcpEncodeContext,
  ): AsyncGenerator<NcpEndpointEvent> {
    const { sessionId, messageId } = context;
    let state = createStreamContentState(this.reasoningNormalizationMode);
    const toolCallBuffers = new Map<number, ToolCallBuffer>();

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta as DeltaLike | undefined;
      if (delta) {
        yield* emitReasoningDelta(delta, { sessionId, messageId });
        const nextState = yield* emitTextDeltas(delta, { sessionId, messageId }, state);
        state = nextState;
        state = yield* closeTextPartBeforeToolCalls(
          delta,
          { sessionId, messageId },
          state,
        );
        yield* emitToolCallDeltas(delta, toolCallBuffers, { sessionId, messageId });
      }

      const finishReason = choice.finish_reason;
      if (typeof finishReason === "string" && finishReason.trim().length > 0) {
        state = yield* flushTextDeltas({ sessionId, messageId }, state);
        yield* flushToolCalls(toolCallBuffers, { sessionId, messageId });
        if (state.textStarted) {
          yield { type: NcpEventType.MessageTextEnd, payload: { sessionId, messageId } };
        }
      }
    }
  }
}
