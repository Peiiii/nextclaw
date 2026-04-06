import { type NcpEndpointEvent, type NcpMessage, type NcpSessionSummary, NcpEventType } from "@nextclaw/ncp";
import type { AgentSessionRecord, LiveSessionState } from "./agent-backend-types.js";

const AUTO_SESSION_LABEL_MAX_LENGTH = 64;

function readOptionalAgentId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readMessages(
  snapshot: {
    messages: ReadonlyArray<NcpMessage>;
    streamingMessage: NcpMessage | null;
  },
): NcpMessage[] {
  const messages = snapshot.messages.map((message) => structuredClone(message));
  if (snapshot.streamingMessage) {
    messages.push(structuredClone(snapshot.streamingMessage));
  }

  return messages;
}

export function toSessionSummary(
  session: AgentSessionRecord,
  liveSession: LiveSessionState | null,
): NcpSessionSummary {
  const metadata = withAutoSessionLabel({
    metadata: session.metadata
      ? structuredClone({
          ...session.metadata,
          ...(liveSession?.metadata ? liveSession.metadata : {}),
        })
      : liveSession?.metadata
        ? structuredClone(liveSession.metadata)
        : {},
    messages: session.messages,
  });
  return {
    sessionId: session.sessionId,
    ...(readOptionalAgentId(session.agentId) ? { agentId: readOptionalAgentId(session.agentId) } : {}),
    messageCount: session.messages.length,
    updatedAt: session.updatedAt,
    status: liveSession?.activeExecution ? "running" : "idle",
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

export function toLiveSessionSummary(session: LiveSessionState): NcpSessionSummary {
  const snapshot = session.stateManager.getSnapshot();
  const messages = readMessages(snapshot);
  const metadata = withAutoSessionLabel({
    metadata:
      Object.keys(session.metadata).length > 0
        ? structuredClone(session.metadata)
        : session.activeExecution?.requestEnvelope.metadata
          ? structuredClone(session.activeExecution.requestEnvelope.metadata)
          : {},
    messages,
  });
  return {
    sessionId: session.sessionId,
    ...(readOptionalAgentId(session.agentId) ? { agentId: readOptionalAgentId(session.agentId) } : {}),
    messageCount: messages.length,
    updatedAt: now(),
    status: session.activeExecution ? "running" : "idle",
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

export function now(): string {
  return new Date().toISOString();
}

function readOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncateLabel(value: string): string {
  const characters = Array.from(value);
  if (characters.length <= AUTO_SESSION_LABEL_MAX_LENGTH) {
    return value;
  }
  return `${characters.slice(0, AUTO_SESSION_LABEL_MAX_LENGTH).join("")}…`;
}

export function resolveAutoSessionLabelFromMessages(
  messages: readonly NcpMessage[],
): string | null {
  for (const message of messages) {
    if (message.role !== "user") {
      continue;
    }
    for (const part of message.parts) {
      if (part.type === "text" || part.type === "rich-text") {
        const text = readOptionalString(part.text);
        if (text) {
          return truncateLabel(text);
        }
      }
    }
  }
  return null;
}

export function withAutoSessionLabel(params: {
  metadata: Record<string, unknown>;
  messages: readonly NcpMessage[];
}): Record<string, unknown> {
  const existingLabel = readOptionalString(params.metadata.label);
  if (existingLabel) {
    return params.metadata;
  }
  const nextLabel = resolveAutoSessionLabelFromMessages(params.messages);
  if (!nextLabel) {
    return params.metadata;
  }
  return {
    ...params.metadata,
    label: nextLabel,
  };
}

export function isTerminalEvent(event: NcpEndpointEvent): boolean {
  switch (event.type) {
    case NcpEventType.MessageAbort:
    case NcpEventType.RunFinished:
    case NcpEventType.RunError:
      return true;
    default:
      return false;
  }
}
