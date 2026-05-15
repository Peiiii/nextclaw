export type FeishuSessionRoute = {
  conversationId: string;
  accountId?: string;
};

const PEER_KINDS = new Set(["direct", "group", "channel"]);

function readPayload(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return (value as { payload?: unknown }).payload;
}

function readNestedMessageSessionId(payload: Record<string, unknown>): string | undefined {
  const message = payload.message;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return undefined;
  }
  const sessionId = (message as { sessionId?: unknown }).sessionId;
  return typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : undefined;
}

export function readFeishuEventSessionId(event: unknown): string | undefined {
  const payload = readPayload(event);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }
  const sessionId = (payload as { sessionId?: unknown }).sessionId;
  if (typeof sessionId === "string" && sessionId.trim()) {
    return sessionId.trim();
  }
  return readNestedMessageSessionId(payload as Record<string, unknown>);
}

export function resolveFeishuSessionRoute(event: unknown): FeishuSessionRoute | null {
  const sessionId = readFeishuEventSessionId(event);
  if (!sessionId) {
    return null;
  }
  const parts = sessionId.split(":");
  const normalizedParts = parts.map((part) => part.toLowerCase());
  if (normalizedParts[0] !== "agent" || parts.length < 5) {
    return null;
  }

  if (normalizedParts[2] === "feishu" && PEER_KINDS.has(normalizedParts[3] ?? "") && parts.length >= 5) {
    return {
      conversationId: parts.slice(4).join(":"),
    };
  }

  if (normalizedParts[2] === "feishu" && PEER_KINDS.has(normalizedParts[4] ?? "") && parts.length >= 6) {
    return {
      accountId: parts[3],
      conversationId: parts.slice(5).join(":"),
    };
  }

  return null;
}
