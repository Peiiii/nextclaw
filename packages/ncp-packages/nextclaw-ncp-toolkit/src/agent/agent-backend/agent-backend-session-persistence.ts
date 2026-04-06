import type { NcpSessionPatch } from "@nextclaw/ncp";
import type { AgentSessionRecord, LiveSessionState } from "./agent-backend-types.js";
import { readMessages, withAutoSessionLabel } from "./agent-backend-session-utils.js";

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
  return (
    readOptionalAgentId(params.liveSession?.agentId) ??
    readOptionalAgentId(params.storedSession?.agentId) ??
    readAgentIdFromMetadata(params.liveSession?.metadata) ??
    readAgentIdFromMetadata(params.storedSession?.metadata)
  );
}

export function buildUpdatedSessionRecord(params: {
  sessionId: string;
  patch: NcpSessionPatch;
  liveSession: LiveSessionState | null;
  storedSession: AgentSessionRecord | null;
  updatedAt: string;
}): AgentSessionRecord {
  const nextMetadata =
    params.patch.metadata === null
      ? {}
      : params.patch.metadata
        ? structuredClone(params.patch.metadata)
        : structuredClone(params.liveSession?.metadata ?? params.storedSession?.metadata ?? {});

  if (params.liveSession) {
    params.liveSession.metadata = structuredClone(nextMetadata);
  }

  return {
    sessionId: params.sessionId,
    ...(resolvePersistedAgentId({
      liveSession: params.liveSession,
      storedSession: params.storedSession,
    })
      ? {
          agentId: resolvePersistedAgentId({
            liveSession: params.liveSession,
            storedSession: params.storedSession,
          })
        }
      : {}),
    messages: params.liveSession
      ? readMessages(params.liveSession.stateManager.getSnapshot())
      : params.storedSession?.messages.map((message) => structuredClone(message)) ?? [],
    updatedAt: params.updatedAt,
    metadata: nextMetadata,
  };
}

export function buildPersistedLiveSessionRecord(params: {
  sessionId: string;
  session: LiveSessionState;
  updatedAt: string;
}): AgentSessionRecord {
  const messages = readMessages(params.session.stateManager.getSnapshot());
  const metadata = withAutoSessionLabel({
    metadata: {
      ...(params.session.metadata ? structuredClone(params.session.metadata) : {}),
      ...(params.session.activeExecution?.requestEnvelope.metadata
        ? structuredClone(params.session.activeExecution.requestEnvelope.metadata)
        : {}),
    },
    messages,
  });
  return {
    sessionId: params.sessionId,
    ...(readOptionalAgentId(params.session.agentId) ??
    readAgentIdFromMetadata(params.session.metadata) ??
    readAgentIdFromMetadata(params.session.activeExecution?.requestEnvelope.metadata)
      ? {
          agentId:
            readOptionalAgentId(params.session.agentId) ??
            readAgentIdFromMetadata(params.session.metadata) ??
            readAgentIdFromMetadata(params.session.activeExecution?.requestEnvelope.metadata)
        }
      : {}),
    messages,
    updatedAt: params.updatedAt,
    metadata,
  };
}
