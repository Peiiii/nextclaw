import type { SessionMessage } from "@core/features/session/stores/session.store.js";

type PendingToolCalls = {
  expectedIds: Set<string>;
  blockStart: number;
};

function collectExpectedToolCallIds(message: SessionMessage): Set<string> {
  const expectedIds = new Set<string>();
  if (!Array.isArray(message.tool_calls)) {
    return expectedIds;
  }
  for (const call of message.tool_calls as Array<Record<string, unknown>>) {
    const callId = typeof call.id === "string" ? call.id.trim() : "";
    if (callId) {
      expectedIds.add(callId);
    }
  }
  return expectedIds;
}

function closeUnmatchedPendingBlock(
  normalized: SessionMessage[],
  pendingToolCalls: PendingToolCalls | null,
  role: string
): { normalized: SessionMessage[]; pendingToolCalls: PendingToolCalls | null } {
  if (!pendingToolCalls || role === "tool") {
    return { normalized, pendingToolCalls };
  }
  const next = pendingToolCalls.expectedIds.size > 0 ? normalized.slice(0, pendingToolCalls.blockStart) : normalized;
  return { normalized: next, pendingToolCalls: null };
}

function appendAssistantMessage(normalized: SessionMessage[], message: SessionMessage) {
  const next = [...normalized, message];
  const expectedIds = collectExpectedToolCallIds(message);
  return {
    normalized: next,
    pendingToolCalls: expectedIds.size > 0 ? { expectedIds, blockStart: next.length - 1 } : null,
  };
}

function appendToolMessage(
  normalized: SessionMessage[],
  pendingToolCalls: PendingToolCalls | null,
  message: SessionMessage
) {
  const callId = typeof message.tool_call_id === "string" ? message.tool_call_id.trim() : "";
  if (!pendingToolCalls || !callId || !pendingToolCalls.expectedIds.has(callId)) {
    return { normalized, pendingToolCalls };
  }
  const expectedIds = new Set(pendingToolCalls.expectedIds);
  expectedIds.delete(callId);
  return {
    normalized: [...normalized, message],
    pendingToolCalls: expectedIds.size > 0 ? { expectedIds, blockStart: pendingToolCalls.blockStart } : null,
  };
}

export function normalizeSessionHistoryWindow(messages: SessionMessage[]): SessionMessage[] {
  let normalized: SessionMessage[] = [];
  let pendingToolCalls: PendingToolCalls | null = null;

  for (const message of messages) {
    const role = typeof message.role === "string" ? message.role : "";
    ({ normalized, pendingToolCalls } = closeUnmatchedPendingBlock(normalized, pendingToolCalls, role));

    if (role === "assistant") {
      ({ normalized, pendingToolCalls } = appendAssistantMessage(normalized, message));
      continue;
    }

    if (role === "tool") {
      ({ normalized, pendingToolCalls } = appendToolMessage(normalized, pendingToolCalls, message));
      continue;
    }

    normalized = [...normalized, message];
  }

  return pendingToolCalls && pendingToolCalls.expectedIds.size > 0
    ? normalized.slice(0, pendingToolCalls.blockStart)
    : normalized;
}
