import {
  type NcpEncodeContext,
  type NcpEndpointEvent,
  type NcpStreamEncoder,
  type OpenAIChatChunk,
  NcpEventType,
} from "@nextclaw/ncp";

type ToolCallBuffer = {
  id?: string;
  name?: string;
  argumentsText: string;
  emittedStart?: boolean;
};

/**
 * Converts LLM stream chunks to NCP events (text, reasoning, tool calls).
 * Does not emit RunFinished; that is the runtime's responsibility after the loop completes.
 */
export class DefaultNcpStreamEncoder implements NcpStreamEncoder {
  encode = async function* (
    stream: AsyncIterable<OpenAIChatChunk>,
    context: NcpEncodeContext,
  ): AsyncGenerator<NcpEndpointEvent> {
    const { sessionId, messageId } = context;
    let textStarted = false;
    const toolCallBuffers = new Map<number, ToolCallBuffer>();

    for await (const chunk of stream) {
      const choice = chunk.choices?.[0];
      if (!choice) {
        if (chunk.usage) continue;
        continue;
      }

      const delta = choice.delta;
      if (delta) {
        if (typeof delta.content === "string" && delta.content.length > 0) {
          if (!textStarted) {
            textStarted = true;
            yield { type: NcpEventType.MessageTextStart, payload: { sessionId, messageId } };
          }
          yield {
            type: NcpEventType.MessageTextDelta,
            payload: { sessionId, messageId, delta: delta.content },
          };
        }

        const reasoning =
          (delta as { reasoning_content?: string }).reasoning_content ??
          (delta as { reasoning?: string }).reasoning;
        if (typeof reasoning === "string" && reasoning) {
          yield {
            type: NcpEventType.MessageReasoningDelta,
            payload: { sessionId, messageId, delta: reasoning },
          };
        }

        const toolDeltas = (delta as { tool_calls?: Array<Record<string, unknown>> }).tool_calls;
        if (Array.isArray(toolDeltas)) {
          for (const toolDelta of toolDeltas) {
            const index =
              typeof toolDelta.index === "number" && Number.isFinite(toolDelta.index)
                ? toolDelta.index
                : toolCallBuffers.size;
            const current = toolCallBuffers.get(index) ?? { argumentsText: "" };
            if (typeof toolDelta.id === "string" && toolDelta.id.trim()) {
              current.id = toolDelta.id;
            }
            const fn = toolDelta.function as { name?: string; arguments?: string } | undefined;
            if (fn && typeof fn === "object" && !Array.isArray(fn)) {
              if (typeof fn.name === "string" && fn.name.trim()) {
                current.name = fn.name.trim();
              }
              if (typeof fn.arguments === "string" && fn.arguments.length > 0) {
                current.argumentsText += fn.arguments;
              }
            }
            if (current.id && current.name && !current.emittedStart) {
              current.emittedStart = true;
              yield {
                type: NcpEventType.MessageToolCallStart,
                payload: { sessionId, toolCallId: current.id, toolName: current.name },
              };
            }
            toolCallBuffers.set(index, current);
          }
        }
      }

      const finishReason = choice.finish_reason;
      if (typeof finishReason === "string" && finishReason.trim().length > 0) {
        const ordered = Array.from(toolCallBuffers.entries()).sort(([a], [b]) => a - b);
        for (const [, buf] of ordered) {
          if (buf.name && buf.id) {
            yield {
              type: NcpEventType.MessageToolCallArgs,
              payload: { sessionId, toolCallId: buf.id, args: buf.argumentsText },
            };
            yield {
              type: NcpEventType.MessageToolCallEnd,
              payload: { sessionId, toolCallId: buf.id },
            };
          }
        }
        if (textStarted) {
          yield { type: NcpEventType.MessageTextEnd, payload: { sessionId, messageId } };
        }
      }
    }
  };
}
