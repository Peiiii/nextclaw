import {
  NcpAssistantTextStreamNormalizer,
  type NcpAssistantReasoningNormalizationMode,
  type NcpEndpointEvent,
} from "@nextclaw/ncp";
import { NcpEventType } from "@nextclaw/ncp";

export type ToolCallBuffer = {
  id?: string;
  name?: string;
  argumentsText: string;
  emittedStart?: boolean;
  emittedArgsDelta?: boolean;
  pendingArgumentDeltas?: string[];
};

export type ToolCallDelta = {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
};

export type DeltaLike = {
  content?: string;
  reasoning_content?: string;
  reasoning?: string;
  tool_calls?: ToolCallDelta[];
};

export type StreamContentState = {
  textStarted: boolean;
  normalizer: NcpAssistantTextStreamNormalizer | null;
};

export function getToolCallIndex(toolDelta: ToolCallDelta, fallback: number): number {
  const idx = toolDelta.index;
  return typeof idx === "number" && Number.isFinite(idx) ? idx : fallback;
}

export function applyToolDelta(current: ToolCallBuffer, toolDelta: ToolCallDelta): ToolCallBuffer {
  const next: ToolCallBuffer = { ...current, argumentsText: current.argumentsText };
  if (typeof toolDelta.id === "string" && toolDelta.id.trim()) {
    next.id = toolDelta.id;
  }
  const fn = toolDelta.function;
  if (fn && typeof fn === "object" && !Array.isArray(fn)) {
    if (typeof fn.name === "string" && fn.name.trim()) {
      next.name = fn.name.trim();
    }
    if (typeof fn.arguments === "string" && fn.arguments.length > 0) {
      next.argumentsText += fn.arguments;
    }
  }
  return next;
}

export function* emitTextDeltas(
  delta: DeltaLike,
  ctx: { sessionId: string; messageId: string },
  state: StreamContentState,
): Generator<NcpEndpointEvent, StreamContentState> {
  const content = delta.content;
  if (typeof content !== "string" || content.length === 0) return state;

  if (state.normalizer) {
    let textStarted = state.textStarted;
    for (const segment of state.normalizer.push(content)) {
      if (segment.type === "reasoning") {
        yield {
          type: NcpEventType.MessageReasoningDelta,
          payload: { ...ctx, delta: segment.text },
        };
        continue;
      }

      if (!textStarted) {
        yield { type: NcpEventType.MessageTextStart, payload: ctx };
        textStarted = true;
      }
      yield {
        type: NcpEventType.MessageTextDelta,
        payload: { ...ctx, delta: segment.text },
      };
    }

    return {
      ...state,
      textStarted,
    };
  }

  if (!state.textStarted) {
    yield { type: NcpEventType.MessageTextStart, payload: ctx };
    yield { type: NcpEventType.MessageTextDelta, payload: { ...ctx, delta: content } };
    return {
      ...state,
      textStarted: true,
    };
  }
  yield { type: NcpEventType.MessageTextDelta, payload: { ...ctx, delta: content } };
  return state;
}

export function* flushTextDeltas(
  ctx: { sessionId: string; messageId: string },
  state: StreamContentState,
): Generator<NcpEndpointEvent, StreamContentState> {
  if (!state.normalizer) {
    return state;
  }

  let textStarted = state.textStarted;
  for (const segment of state.normalizer.finish()) {
    if (segment.type === "reasoning") {
      yield {
        type: NcpEventType.MessageReasoningDelta,
        payload: { ...ctx, delta: segment.text },
      };
      continue;
    }

    if (!textStarted) {
      yield { type: NcpEventType.MessageTextStart, payload: ctx };
      textStarted = true;
    }
    yield {
      type: NcpEventType.MessageTextDelta,
      payload: { ...ctx, delta: segment.text },
    };
  }

  return {
    ...state,
    textStarted,
  };
}

export function* emitReasoningDelta(
  delta: DeltaLike,
  ctx: { sessionId: string; messageId: string },
): Generator<NcpEndpointEvent> {
  const reasoning = delta.reasoning_content ?? delta.reasoning;
  if (typeof reasoning !== "string" || !reasoning) return;

  yield { type: NcpEventType.MessageReasoningDelta, payload: { ...ctx, delta: reasoning } };
}

export function* emitToolCallDeltas(
  delta: DeltaLike,
  buffers: Map<number, ToolCallBuffer>,
  ctx: { sessionId: string; messageId: string },
): Generator<NcpEndpointEvent> {
  const toolDeltas = delta.tool_calls;
  if (!Array.isArray(toolDeltas)) return;

  for (const toolDelta of toolDeltas) {
    const index = getToolCallIndex(toolDelta, buffers.size);
    const prev = buffers.get(index) ?? {
      argumentsText: "",
      pendingArgumentDeltas: [],
    };
    const current = applyToolDelta(prev, toolDelta);
    const argsDelta =
      typeof toolDelta.function?.arguments === "string" &&
      toolDelta.function.arguments.length > 0
        ? toolDelta.function.arguments
        : null;
    const toolCallId = current.id;
    const toolName = current.name;
    if (toolCallId && toolName && !current.emittedStart) {
      yield {
        type: NcpEventType.MessageToolCallStart,
        payload: { ...ctx, toolCallId, toolName },
      };
      current.emittedStart = true;
    }

    if (argsDelta) {
      if (current.emittedStart && current.id) {
        yield {
          type: NcpEventType.MessageToolCallArgsDelta,
          payload: {
            ...ctx,
            toolCallId: current.id,
            delta: argsDelta,
          },
        };
        current.emittedArgsDelta = true;
      } else {
        current.pendingArgumentDeltas = [
          ...(current.pendingArgumentDeltas ?? []),
          argsDelta,
        ];
      }
    }

    if (current.emittedStart && current.id && (current.pendingArgumentDeltas?.length ?? 0) > 0) {
      for (const pendingDelta of current.pendingArgumentDeltas ?? []) {
        yield {
          type: NcpEventType.MessageToolCallArgsDelta,
          payload: {
            ...ctx,
            toolCallId: current.id,
            delta: pendingDelta,
          },
        };
      }
      current.emittedArgsDelta = true;
      current.pendingArgumentDeltas = [];
    }

    buffers.set(index, current);
  }
}

export function* flushToolCalls(
  buffers: Map<number, ToolCallBuffer>,
  ctx: { sessionId: string; messageId: string },
): Generator<NcpEndpointEvent> {
  const ordered = Array.from(buffers.entries()).sort(([a], [b]) => a - b);
  for (const [, buf] of ordered) {
    if (!buf.id || !buf.name) continue;
    if (!buf.emittedArgsDelta) {
      yield {
        type: NcpEventType.MessageToolCallArgs,
        payload: { ...ctx, toolCallId: buf.id, args: buf.argumentsText },
      };
    }
    yield {
      type: NcpEventType.MessageToolCallEnd,
      payload: { ...ctx, toolCallId: buf.id },
    };
  }
}

export function createStreamContentState(
  reasoningNormalizationMode: NcpAssistantReasoningNormalizationMode,
): StreamContentState {
  return {
    textStarted: false,
    normalizer:
      reasoningNormalizationMode === "think-tags"
        ? new NcpAssistantTextStreamNormalizer(reasoningNormalizationMode)
        : null,
  };
}
