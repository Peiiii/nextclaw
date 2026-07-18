import type { NcpError, NcpMessage, NcpMessageStatus, NcpRunErrorPayload, NcpRunFinishedPayload } from "@nextclaw/ncp";
import { normalizeConversationMessage } from "./agent-conversation-message-normalizer.js";

export const ABORTED_TOOL_CALL_SENTINEL = "__nextclaw_aborted_tool_call__";

export function buildRuntimeError(payload: NcpRunErrorPayload): NcpError {
  const message = payload.error?.trim();
  return {
    code: "runtime-error",
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
  return lifecycle
    ? {
        ...message,
        status,
        lifecycle
      }
    : {
        ...message,
        status
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
        ...toolPart
      };
      return nextParts;
    }
  }
  nextParts.push(toolPart);
  return nextParts;
}

export function cancelInFlightToolInvocations(parts: NcpMessage["parts"]): {
  parts: NcpMessage["parts"];
  toolCallIds: string[];
} {
  const toolCallIds: string[] = [];
  return {
    parts: parts.map((part) => {
      if (part.type !== "tool-invocation" || !part.toolCallId || part.state === "result" || part.state === "cancelled") {
        return part;
      }
      toolCallIds.push(part.toolCallId);
      return {
        ...part,
        state: "cancelled" as const
      };
    }),
    toolCallIds
  };
}
