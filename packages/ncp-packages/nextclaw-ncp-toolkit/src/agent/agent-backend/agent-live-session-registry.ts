import type { NcpAgentRuntime, NcpMessage } from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "../agent-conversation-state-manager.js";
import type {
  AgentSessionStore,
  CreateRuntimeFn,
  LiveSessionState,
} from "./agent-backend-types.js";
import { EventPublisher } from "./event-publisher.js";

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

export class AgentLiveSessionRegistry {
  private readonly sessions = new Map<string, LiveSessionState>();

  constructor(
    private readonly sessionStore: AgentSessionStore,
    private readonly createRuntime: CreateRuntimeFn,
  ) {}

  readonly ensureSession = async (
    sessionId: string,
    initialMetadata?: Record<string, unknown>,
  ): Promise<LiveSessionState> => {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      if (!existing.agentId) {
        existing.agentId = readAgentIdFromMetadata(initialMetadata) ?? existing.agentId;
      }
      if (initialMetadata && Object.keys(initialMetadata).length > 0) {
        existing.metadata = {
          ...existing.metadata,
          ...structuredClone(initialMetadata),
        };
      }
      return existing;
    }

    const storedSession = await this.sessionStore.getSession(sessionId);
    const stateManager = new DefaultNcpAgentConversationStateManager();
    stateManager.hydrate({
      sessionId,
      messages: cloneMessages(storedSession?.messages ?? []),
    });
    const sessionMetadata = {
      ...(storedSession?.metadata
        ? structuredClone(storedSession.metadata)
        : {}),
      ...(initialMetadata ? structuredClone(initialMetadata) : {}),
    };
    const sessionAgentId =
      readOptionalAgentId(storedSession?.agentId) ??
      readAgentIdFromMetadata(initialMetadata);

    const session: LiveSessionState = {
      sessionId,
      ...(sessionAgentId ? { agentId: sessionAgentId } : {}),
      stateManager,
      metadata: sessionMetadata,
      runtime: null as unknown as NcpAgentRuntime,
      publisher: new EventPublisher(),
      activeExecution: null,
    };

    session.runtime = this.createRuntime({
      sessionId,
      ...(sessionAgentId ? { agentId: sessionAgentId } : {}),
      stateManager,
      sessionMetadata,
      setSessionMetadata: (nextMetadata) => {
        session.metadata = {
          ...structuredClone(nextMetadata),
        };
      },
    });
    this.sessions.set(sessionId, session);
    return session;
  };

  readonly getSession = (sessionId: string): LiveSessionState | null => {
    return this.sessions.get(sessionId) ?? null;
  };

  readonly deleteSession = (sessionId: string): LiveSessionState | null => {
    const session = this.sessions.get(sessionId) ?? null;
    if (session) {
      this.sessions.delete(sessionId);
    }
    return session;
  };

  readonly clear = (): void => {
    this.sessions.clear();
  };

  readonly listSessions = (): LiveSessionState[] => {
    return [...this.sessions.values()];
  };
}

function cloneMessages(messages: ReadonlyArray<NcpMessage>): NcpMessage[] {
  return messages.map((message) => structuredClone(message));
}
