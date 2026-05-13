import {
  type NcpCompletedEnvelope,
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpSessionSummary,
  NcpEventType,
} from "@nextclaw/ncp";
import type {
  AgentSessionRecord,
  AgentSessionStore,
  LiveSessionState,
} from "./agent-backend.types.js";

const AUTO_SESSION_LABEL_MAX_LENGTH = 64;

export type SessionContextWindowResolver = (params: {
  messages: readonly NcpMessage[];
  metadata: Record<string, unknown>;
  sessionId: string;
}) => Record<string, unknown> | null;

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

export function readSessionActivityAt(summary: NcpSessionSummary): string {
  return summary.lastMessageAt ?? summary.createdAt ?? summary.updatedAt;
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
    ...(session.createdAt ? { createdAt: session.createdAt } : {}),
    updatedAt: session.updatedAt,
    ...(session.messages.length > 0
      ? {
          lastMessageAt:
            session.messages[session.messages.length - 1]?.timestamp ??
            session.updatedAt,
        }
      : {}),
    status: liveSession?.activeExecution ? "running" : "idle",
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

export function toLiveSessionSummary(session: LiveSessionState): NcpSessionSummary {
  const snapshot = session.stateManager.getSnapshot();
  const messages = readMessages(snapshot);
  const updatedAt = now();
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
    createdAt: session.createdAt,
    updatedAt,
    ...(messages.length > 0
      ? {
          lastMessageAt: messages[messages.length - 1]?.timestamp ?? updatedAt,
        }
      : {}),
    status: session.activeExecution ? "running" : "idle",
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  };
}

export function withSessionContextWindow(
  summary: NcpSessionSummary,
  messages: readonly NcpMessage[],
  resolver?: SessionContextWindowResolver,
): NcpSessionSummary {
  const contextWindow = resolver?.({
    messages,
    metadata: summary.metadata ?? {},
    sessionId: summary.sessionId,
  });
  return contextWindow ? { ...summary, contextWindow } : summary;
}

export function toLiveSessionSummaryWithContextWindow(
  session: LiveSessionState,
  resolver?: SessionContextWindowResolver,
): NcpSessionSummary {
  const messages = readMessages(session.stateManager.getSnapshot());
  return withSessionContextWindow(toLiveSessionSummary(session), messages, resolver);
}

export async function listBackendSessionSummaries(params: {
  sessionStore: AgentSessionStore;
  liveSessions: LiveSessionState[];
}): Promise<NcpSessionSummary[]> {
  const { liveSessions, sessionStore } = params;
  const summaries = sessionStore.listSessionSummaries
    ? await sessionStore.listSessionSummaries()
    : (await sessionStore.listSessions()).map((session) =>
        toSessionSummary(session, liveSessions.find((liveSession) => liveSession.sessionId === session.sessionId) ?? null),
      );

  for (const liveSession of liveSessions) {
    const existingIndex = summaries.findIndex(
      (session) => session.sessionId === liveSession.sessionId,
    );
    if (existingIndex >= 0) {
      summaries[existingIndex] = {
        ...summaries[existingIndex],
        status: liveSession.activeExecution ? "running" : "idle",
      };
      continue;
    }
    summaries.push(toLiveSessionSummary(liveSession));
  }

  return summaries.sort((left, right) =>
    readSessionActivityAt(right).localeCompare(readSessionActivityAt(left)),
  );
}

export async function listBackendSessionMessages(params: {
  sessionStore: AgentSessionStore;
  liveSession: LiveSessionState | null;
  sessionId: string;
}): Promise<NcpMessage[]> {
  const { liveSession, sessionId, sessionStore } = params;
  if (liveSession) return readMessages(liveSession.stateManager.getSnapshot());
  if (sessionStore.listSessionMessages) {
    return sessionStore.listSessionMessages(sessionId);
  }
  const session = await sessionStore.getSession(sessionId);
  return session
    ? session.messages.map((message) => structuredClone(message))
    : [];
}

export async function getBackendSessionSummary(params: {
  sessionStore: AgentSessionStore;
  liveSession: LiveSessionState | null;
  sessionId: string;
  resolveSessionContextWindow?: SessionContextWindowResolver;
}): Promise<NcpSessionSummary | null> {
  const {
    liveSession,
    resolveSessionContextWindow,
    sessionId,
    sessionStore,
  } = params;
  if (!liveSession && sessionStore.getSessionSummary) {
    return sessionStore.getSessionSummary(sessionId);
  }
  const storedSession = await sessionStore.getSession(sessionId);
  const liveMessages = liveSession
    ? readMessages(liveSession.stateManager.getSnapshot())
    : null;
  return storedSession
    ? withSessionContextWindow(
        toSessionSummary(storedSession, liveSession),
        liveMessages ?? storedSession.messages,
        resolveSessionContextWindow,
      )
    : liveSession
      ? toLiveSessionSummaryWithContextWindow(liveSession, resolveSessionContextWindow)
      : null;
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
  const { metadata, messages } = params;
  const existingLabel = readOptionalString(metadata.label);
  if (existingLabel) {
    return metadata;
  }
  const nextLabel = resolveAutoSessionLabelFromMessages(messages);
  if (!nextLabel) {
    return metadata;
  }
  return {
    ...metadata,
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

function findFinalAssistantMessageById(
  session: LiveSessionState,
  messageId: string,
): NcpMessage | null {
  const normalizedMessageId = messageId.trim();
  if (!normalizedMessageId) {
    return null;
  }
  const snapshot = session.stateManager.getSnapshot();
  for (let index = snapshot.messages.length - 1; index >= 0; index -= 1) {
    const message = snapshot.messages[index];
    if (
      message?.id === normalizedMessageId &&
      message.role === "assistant" &&
      message.status === "final"
    ) {
      return message;
    }
  }
  return null;
}

function buildCompletedEventForFinishedRun(
  session: LiveSessionState,
  event: Extract<NcpEndpointEvent, { type: NcpEventType.RunFinished }>,
): { type: NcpEventType.MessageCompleted; payload: NcpCompletedEnvelope } {
  const messageId = event.payload.messageId?.trim();
  if (!messageId) {
    throw new Error(
      `Run finished without messageId for session "${session.sessionId}".`,
    );
  }
  const completedMessage = findFinalAssistantMessageById(session, messageId);
  if (!completedMessage) {
    throw new Error(
      `Run finished without a final assistant message for session "${session.sessionId}" and message "${messageId}".`,
    );
  }
  return {
    type: NcpEventType.MessageCompleted,
    payload: {
      sessionId: session.sessionId,
      message: structuredClone(completedMessage),
    },
  };
}

export function normalizeSendRunEvent(params: {
  session: LiveSessionState;
  event: NcpEndpointEvent;
  completedMessageSeen: boolean;
}): {
  eventsToPublish: NcpEndpointEvent[];
  completedMessageSeen: boolean;
} {
  const { session, event } = params;
  if (event.type === NcpEventType.MessageCompleted) {
    if (params.completedMessageSeen) {
      throw new Error(
        `Multiple final assistant messages were emitted for session "${session.sessionId}".`,
      );
    }
    return {
      eventsToPublish: [event],
      completedMessageSeen: true,
    };
  }

  if (event.type === NcpEventType.RunFinished) {
    if (params.completedMessageSeen) {
      return {
        eventsToPublish: [event],
        completedMessageSeen: true,
      };
    }
    return {
      eventsToPublish: [buildCompletedEventForFinishedRun(session, event), event],
      completedMessageSeen: true,
    };
  }

  return {
    eventsToPublish: [event],
    completedMessageSeen: params.completedMessageSeen,
  };
}
