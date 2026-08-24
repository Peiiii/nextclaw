import {
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  type NcpError,
  NcpEventType,
  type NcpMessage,
  type NcpMessageStatus,
  type NcpRunErrorPayload,
  type NcpRunFinishedPayload,
  type NcpToolExecutionTiming,
} from "@nextclaw/ncp";
import { normalizeConversationMessage } from "./agent-conversation-message-normalizer.js";

export const ABORTED_TOOL_CALL_SENTINEL = "__nextclaw_aborted_tool_call__";

export function routeAgentConversationEvent(
  manager: NcpAgentConversationStateManager,
  event: NcpEndpointEvent,
): void {
  switch (event.type) {
    case NcpEventType.MessageSent:
      manager.handleMessageSent(event.payload);
      break;
    case NcpEventType.MessageCompleted:
      manager.handleMessageCompleted(event.payload);
      break;
    case NcpEventType.MessageAbort:
      manager.handleMessageAbort(event.payload, event.occurredAt);
      break;
    case NcpEventType.MessageFailed:
      manager.handleMessageFailed(event.payload, event.occurredAt);
      break;
    case NcpEventType.MessageTextStart:
      manager.handleMessageTextStart(event.payload);
      break;
    case NcpEventType.MessageTextDelta:
      manager.handleMessageTextDelta(event.payload);
      break;
    case NcpEventType.MessageTextEnd:
      manager.handleMessageTextEnd(event.payload);
      break;
    case NcpEventType.MessageReasoningStart:
      manager.handleMessageReasoningStart(event.payload);
      break;
    case NcpEventType.MessageReasoningDelta:
      manager.handleMessageReasoningDelta(event.payload);
      break;
    case NcpEventType.MessageReasoningEnd:
      manager.handleMessageReasoningEnd(event.payload);
      break;
    case NcpEventType.MessageToolCallStart:
      manager.handleMessageToolCallStart(event.payload);
      break;
    case NcpEventType.MessageToolCallArgs:
      manager.handleMessageToolCallArgs(event.payload);
      break;
    case NcpEventType.MessageToolCallArgsDelta:
      manager.handleMessageToolCallArgsDelta(event.payload);
      break;
    case NcpEventType.MessageToolCallEnd:
      manager.handleMessageToolCallEnd(event.payload);
      break;
    case NcpEventType.MessageToolExecutionStarted:
      manager.handleMessageToolExecutionStarted(event.payload, event.occurredAt);
      break;
    case NcpEventType.MessageToolCallResult:
      manager.handleMessageToolCallResult(event.payload, event.occurredAt);
      break;
    case NcpEventType.RunStarted:
      manager.handleRunStarted(event.payload, event.occurredAt);
      break;
    case NcpEventType.RunFinished:
      manager.handleRunFinished(event.payload, event.occurredAt);
      break;
    case NcpEventType.RunError:
      manager.handleRunError(event.payload, event.occurredAt);
      break;
    case NcpEventType.RunMetadata:
      manager.handleRunMetadata(event.payload);
      break;
    case NcpEventType.ContextWindowUpdated:
      manager.handleContextWindowUpdated(event.payload);
      break;
    case NcpEventType.EndpointError:
      manager.handleEndpointError(event.payload, event.occurredAt);
      break;
    default:
      break;
  }
}

export function normalizeToolExecutionTiming(
  execution: NcpToolExecutionTiming | undefined,
  fallbackEndedAt?: string,
): NcpToolExecutionTiming | undefined {
  const startedAt = normalizeToolExecutionTimestamp(execution?.startedAt);
  const endedAt = normalizeToolExecutionTimestamp(execution?.endedAt ?? fallbackEndedAt);
  const durationMs = execution?.durationMs;
  const normalizedDurationMs =
    typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0
      ? durationMs
      : undefined;
  if (!startedAt && !endedAt && normalizedDurationMs === undefined) return undefined;
  return {
    ...(startedAt ? { startedAt } : {}),
    ...(endedAt ? { endedAt } : {}),
    ...(normalizedDurationMs !== undefined ? { durationMs: normalizedDurationMs } : {}),
  };
}

export function normalizeToolExecutionTimestamp(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export function mergeToolExecutionTiming(
  current: NcpToolExecutionTiming | undefined,
  incoming: NcpToolExecutionTiming | undefined,
): NcpToolExecutionTiming | undefined {
  if (!current) return incoming;
  if (!incoming) return current;
  const normalizedCurrent = normalizeToolExecutionTiming(current);
  const normalizedIncoming = normalizeToolExecutionTiming(incoming);
  const currentStartedAt = normalizedCurrent?.startedAt;
  const incomingStartedAt = normalizedIncoming?.startedAt;
  const startedAt = currentStartedAt && incomingStartedAt
    ? Date.parse(currentStartedAt) <= Date.parse(incomingStartedAt)
      ? currentStartedAt
      : incomingStartedAt
    : currentStartedAt ?? incomingStartedAt;
  const currentDuration = normalizedCurrent?.durationMs;
  const incomingDuration = normalizedIncoming?.durationMs;
  const durationMs = currentDuration ?? incomingDuration;
  const endedAt = currentDuration !== undefined
    ? normalizedCurrent?.endedAt ?? normalizedIncoming?.endedAt
    : incomingDuration !== undefined
      ? normalizedIncoming?.endedAt ?? normalizedCurrent?.endedAt
      : normalizedCurrent?.endedAt ?? normalizedIncoming?.endedAt;
  return {
    ...(startedAt ? { startedAt } : {}),
    ...(endedAt ? { endedAt } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

export function buildRuntimeError(payload: NcpRunErrorPayload): NcpError {
  const message = payload.error?.trim();
  return {
    code: payload.interrupted ? "run-interrupted" : "runtime-error",
    message: message && message.length > 0 ? message : "Agent run failed.",
    details: {
      sessionId: payload.sessionId,
      messageId: payload.messageId,
      threadId: payload.threadId,
      runId: payload.runId
    }
  };
}

export function readMessageLifecycleFromRunPayload(
  payload: Pick<NcpRunFinishedPayload | NcpRunErrorPayload, "startedAt" | "endedAt">
): NcpMessage["lifecycle"] | undefined {
  if (!payload.startedAt && !payload.endedAt) {
    return undefined;
  }
  return {
    startedAt: payload.startedAt,
    endedAt: payload.endedAt
  };
}

export function settleMessageWithLifecycle(
  message: NcpMessage,
  status: Extract<NcpMessageStatus, "final" | "error">,
  lifecycle?: NcpMessage["lifecycle"]
): NcpMessage {
  const parts = status === "error" || lifecycle?.endedAt
    ? cancelInFlightToolInvocations(message.parts, lifecycle?.endedAt).parts
    : message.parts;
  return lifecycle
    ? {
        ...message,
        status,
        parts,
        lifecycle
      }
    : {
        ...message,
        status,
        parts
      };
}

function resolveTimelineInsertIndex(messages: readonly NcpMessage[], message: NcpMessage): number {
  const targetTimestamp = Date.parse(message.timestamp);
  if (!Number.isFinite(targetTimestamp)) {
    return messages.length;
  }
  const laterMessageIndex = messages.findIndex((item) => {
    const timestamp = Date.parse(item.timestamp);
    return Number.isFinite(timestamp) && timestamp > targetTimestamp;
  });
  return laterMessageIndex < 0 ? messages.length : laterMessageIndex;
}

export function insertMessageByTimeline(messages: readonly NcpMessage[], message: NcpMessage): NcpMessage[] {
  const nextMessages = [...messages];
  nextMessages.splice(resolveTimelineInsertIndex(messages, message), 0, message);
  return nextMessages;
}

export function rebaseStreamingMessageIndex(
  currentMessages: readonly NcpMessage[],
  nextMessages: readonly NcpMessage[],
  currentIndex: number
): number {
  const leftMessageId = currentIndex > 0 ? currentMessages[currentIndex - 1]?.id : null;
  const rightMessageId = currentMessages[currentIndex]?.id;
  const rightIndex = rightMessageId
    ? nextMessages.findIndex((message) => message.id === rightMessageId)
    : -1;
  if (rightIndex >= 0) return rightIndex;
  const leftIndex = leftMessageId
    ? nextMessages.findIndex((message) => message.id === leftMessageId)
    : -1;
  return leftIndex >= 0 ? leftIndex + 1 : nextMessages.length;
}

export function upsertMessageByEventOrder(
  messages: readonly NcpMessage[],
  streamingMessage: NcpMessage | null,
  streamingMessageIndex: number | null,
  message: NcpMessage
): {
  messages: NcpMessage[];
  streamingMessage: NcpMessage | null;
  streamingMessageIndex: number | null;
} {
  const normalizedMessage = normalizeConversationMessage(message);
  const settlesStreamingMessage = streamingMessage?.id === normalizedMessage.id;
  const messageIndex = messages.findIndex((item) => item.id === normalizedMessage.id);
  const nextMessages = [...messages];
  if (messageIndex >= 0) {
    nextMessages[messageIndex] = normalizedMessage;
  } else {
    const insertIndex = settlesStreamingMessage
      ? Math.min(Math.max(streamingMessageIndex ?? messages.length, 0), messages.length)
      : messages.length;
    nextMessages.splice(insertIndex, 0, normalizedMessage);
  }
  return {
    messages: nextMessages,
    streamingMessage: settlesStreamingMessage ? null : streamingMessage,
    streamingMessageIndex: settlesStreamingMessage ? null : streamingMessageIndex
  };
}

export function prependConversationHistory(
  currentMessages: readonly NcpMessage[],
  streamingMessage: NcpMessage | null,
  history: ReadonlyArray<NcpMessage>
): NcpMessage[] {
  const knownIds = new Set(currentMessages.map((message) => message.id));
  if (streamingMessage) {
    knownIds.add(streamingMessage.id);
  }
  let messages = currentMessages as NcpMessage[];
  for (const message of history) {
    if (knownIds.has(message.id)) {
      continue;
    }
    knownIds.add(message.id);
    messages = insertMessageByTimeline(messages, normalizeConversationMessage(message));
  }
  return messages;
}

export function shouldPromoteStreamingMessageId(message: NcpMessage, nextMessageId: string): boolean {
  if (!nextMessageId.trim()) {
    return false;
  }
  if (message.id.startsWith("tool-")) {
    return true;
  }
  return message.parts.some((part) => part.type === "tool-invocation");
}

export function findToolInvocationPart(
  parts: NcpMessage["parts"],
  toolCallId: string
): Extract<NcpMessage["parts"][number], { type: "tool-invocation" }> | null {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part.type === "tool-invocation" && part.toolCallId === toolCallId) {
      return part;
    }
  }
  return null;
}

export function findToolNameByCallId(parts: NcpMessage["parts"], toolCallId: string): string | null {
  const part = findToolInvocationPart(parts, toolCallId);
  return part?.toolName ?? null;
}

export function upsertToolInvocationPart(
  parts: NcpMessage["parts"],
  toolPart: Extract<NcpMessage["parts"][number], { type: "tool-invocation" }>
): NcpMessage["parts"] {
  const nextParts = [...parts];
  for (let index = nextParts.length - 1; index >= 0; index -= 1) {
    const part = nextParts[index];
    if (part.type === "tool-invocation" && part.toolCallId === toolPart.toolCallId) {
      nextParts[index] = {
        ...part,
        ...toolPart,
        ...(
          part.execution || toolPart.execution
            ? { execution: { ...part.execution, ...toolPart.execution } }
            : {}
        ),
      };
      return nextParts;
    }
  }
  nextParts.push(toolPart);
  return nextParts;
}

export function cancelInFlightToolInvocations(
  parts: NcpMessage["parts"],
  endedAt?: string,
): {
  parts: NcpMessage["parts"];
  toolCallIds: string[];
} {
  const toolCallIds: string[] = [];
  const parsedEndedAt = endedAt ? Date.parse(endedAt) : NaN;
  const normalizedEndedAt = Number.isFinite(parsedEndedAt)
    ? new Date(parsedEndedAt).toISOString()
    : undefined;
  return {
    parts: parts.map((part) => {
      if (part.type !== "tool-invocation" || !part.toolCallId || part.state === "result" || part.state === "cancelled") {
        return part;
      }
      toolCallIds.push(part.toolCallId);
      return {
        ...part,
        state: "cancelled" as const,
        ...(
          part.execution?.startedAt && !part.execution.endedAt
            ? {
                execution: {
                  ...part.execution,
                  ...(normalizedEndedAt ? { endedAt: normalizedEndedAt } : {}),
                },
              }
            : {}
        ),
      };
    }),
    toolCallIds
  };
}
