import type { NcpMessage, NcpSessionStatus, NcpSessionSummary } from "@nextclaw/ncp";

export function createNcpSessionSummary(params: {
  sessionId: string;
  agentId?: string;
  messages: readonly NcpMessage[];
  createdAt: string;
  updatedAt: string;
  status: NcpSessionStatus;
  metadata?: Record<string, unknown>;
  contextWindow?: Record<string, unknown> | null;
}): NcpSessionSummary {
  const { sessionId, agentId, messages, createdAt, updatedAt, status, metadata, contextWindow } = params;
  return {
    sessionId,
    ...(agentId ? { agentId } : {}),
    messageCount: messages.length,
    createdAt,
    updatedAt,
    ...(messages.length > 0
      ? {
          lastMessageAt:
            messages[messages.length - 1]?.timestamp ?? updatedAt,
        }
      : {}),
    status,
    ...(metadata ? { metadata: structuredClone(metadata) } : {}),
    ...(contextWindow ? { contextWindow: structuredClone(contextWindow) } : {}),
  };
}
