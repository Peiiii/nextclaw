import type { NcpEndpointEvent, NcpSessionPatch } from "@nextclaw/ncp";
import type {
  AgentSessionEventRecord,
  AgentSessionRecord,
  AgentSessionStore,
  LiveSessionState,
} from "./agent-backend.types.js";
import { readMessages, withAutoSessionLabel } from "./agent-backend-session.utils.js";

function readOptionalAgentId(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readAgentIdFromMetadata(metadata: Record<string, unknown> | null | undefined): string | undefined {
  return readOptionalAgentId(metadata?.agent_id) ?? readOptionalAgentId(metadata?.agentId);
}

function resolvePersistedAgentId(params: {
  liveSession: LiveSessionState | null;
  storedSession: AgentSessionRecord | null;
}): string | undefined {
  const { liveSession, storedSession } = params;
  return (
    readOptionalAgentId(liveSession?.agentId) ??
    readOptionalAgentId(storedSession?.agentId) ??
    readAgentIdFromMetadata(liveSession?.metadata) ??
    readAgentIdFromMetadata(storedSession?.metadata)
  );
}

export function buildUpdatedSessionRecord(params: {
  sessionId: string;
  patch: NcpSessionPatch;
  liveSession: LiveSessionState | null;
  storedSession: AgentSessionRecord | null;
  updatedAt: string;
}): AgentSessionRecord {
  const {
    liveSession,
    patch,
    sessionId,
    storedSession,
    updatedAt,
  } = params;
  const nextMetadata =
    patch.metadata === null
      ? {}
      : patch.metadata
        ? structuredClone(patch.metadata)
        : structuredClone(liveSession?.metadata ?? storedSession?.metadata ?? {});

  if (liveSession) {
    liveSession.metadata = structuredClone(nextMetadata);
  }
  const agentId = resolvePersistedAgentId({
    liveSession,
    storedSession,
  });

  return {
    sessionId,
    ...(agentId ? { agentId } : {}),
    messages: liveSession
      ? readMessages(liveSession.stateManager.getSnapshot())
      : storedSession?.messages.map((message) => structuredClone(message)) ?? [],
    createdAt: storedSession?.createdAt ?? liveSession?.createdAt ?? updatedAt,
    updatedAt,
    metadata: nextMetadata,
  };
}

export function buildPersistedLiveSessionRecord(params: {
  sessionId: string;
  session: LiveSessionState;
  updatedAt: string;
}): AgentSessionRecord {
  const { session, sessionId, updatedAt } = params;
  const messages = readMessages(session.stateManager.getSnapshot());
  const metadata = withAutoSessionLabel({
    metadata: {
      ...(session.metadata ? structuredClone(session.metadata) : {}),
      ...(session.activeExecution?.requestEnvelope.metadata
        ? structuredClone(session.activeExecution.requestEnvelope.metadata)
        : {}),
    },
    messages,
  });
  const agentId =
    readOptionalAgentId(session.agentId) ??
    readAgentIdFromMetadata(session.metadata) ??
    readAgentIdFromMetadata(session.activeExecution?.requestEnvelope.metadata);
  return {
    sessionId,
    ...(agentId ? { agentId } : {}),
    messages,
    createdAt: session.createdAt,
    updatedAt,
    metadata,
  };
}

export function buildLiveSessionEventRecord(params: {
  session: LiveSessionState;
  updatedAt: string;
}): AgentSessionEventRecord {
  const { session, updatedAt } = params;
  const metadata = {
    ...(session.metadata ? structuredClone(session.metadata) : {}),
    ...(session.activeExecution?.requestEnvelope.metadata
      ? structuredClone(session.activeExecution.requestEnvelope.metadata)
      : {}),
  };
  const agentId =
    readOptionalAgentId(session.agentId) ??
    readAgentIdFromMetadata(session.metadata) ??
    readAgentIdFromMetadata(session.activeExecution?.requestEnvelope.metadata);
  return {
    sessionId: session.sessionId,
    ...(agentId ? { agentId } : {}),
    createdAt: session.createdAt,
    updatedAt,
    metadata,
  };
}

export function shouldPersistRunEndSnapshot(sessionStore: AgentSessionStore): boolean {
  return !sessionStore.appendSessionEvent;
}

export async function persistLiveSession(params: {
  sessionStore: AgentSessionStore;
  session: LiveSessionState | null;
  sessionId: string;
  updatedAt: string;
}): Promise<void> {
  const { session, sessionId, sessionStore, updatedAt } = params;
  if (!session) {
    return;
  }
  await sessionStore.saveSession(
    buildPersistedLiveSessionRecord({
      sessionId,
      session,
      updatedAt,
    }),
  );
}

export async function persistLiveSessionEvent(params: {
  sessionStore: AgentSessionStore;
  session: LiveSessionState;
  event: NcpEndpointEvent;
  updatedAt: string;
}): Promise<void> {
  const { event, session, sessionStore, updatedAt } = params;
  if (sessionStore.appendSessionEvent) {
    await sessionStore.appendSessionEvent({
      session: buildLiveSessionEventRecord({
        session,
        updatedAt,
      }),
      event,
      updatedAt,
    });
    return;
  }
  await sessionStore.saveSession(
    buildPersistedLiveSessionRecord({
      sessionId: session.sessionId,
      session,
      updatedAt,
    }),
  );
}
