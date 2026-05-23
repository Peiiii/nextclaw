import {
  eventKeys,
  type EventBus,
} from "@nextclaw/shared";
import type { UpdateToolCallResult } from "@kernel/managers/tool.manager.js";
import {
  NcpEventType,
  type NcpAgentRuntime,
  type NcpAgentRunStreamOptions,
  type NcpEndpointEvent,
  type NcpStreamRequestPayload,
} from "@nextclaw/ncp";
import {
  DefaultNcpAgentConversationStateManager,
} from "@nextclaw/ncp-toolkit";
import {
  AsyncEventQueue,
  buildSessionRecord,
  disposeRuntime,
  type LiveSession,
  type LiveSessionExecution,
  type PublishSessionEventOptions,
  readAgentId,
  readString,
} from "@kernel/utils/session-run.utils.js";
import type { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";
import type { NcpSessionManager } from "@kernel/managers/ncp-session.manager.js";

type Cleanup = () => Promise<void> | void;

function isDurableSessionEvent(event: NcpEndpointEvent): boolean {
  return event.type !== NcpEventType.ContextWindowUpdated;
}

function readEventSessionId(event: NcpEndpointEvent): string | null {
  const payload = "payload" in event ? event.payload : null;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return "sessionId" in payload && typeof payload.sessionId === "string"
    ? payload.sessionId
    : null;
}

export class SessionRunManager {
  private readonly agentRuntimeManager: AgentRuntimeManager;
  private readonly ncpSessionManager: NcpSessionManager;
  private readonly eventBus: EventBus;
  private readonly liveSessions = new Map<string, LiveSession>();
  private readonly cleanups: Cleanup[] = [];
  private disposed = false;

  constructor(options: {
    agentRuntimeManager: AgentRuntimeManager;
    eventBus: EventBus;
    ncpSessionManager: NcpSessionManager;
  }) {
    const {
      agentRuntimeManager,
      eventBus,
      ncpSessionManager,
    } = options;
    this.agentRuntimeManager = agentRuntimeManager;
    this.ncpSessionManager = ncpSessionManager;
    this.eventBus = eventBus;
    this.ncpSessionManager.installLiveMetadataWriter(this.writeLiveSessionMetadata);
  }

  dispose = async (): Promise<void> => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    while (this.cleanups.length > 0) {
      await this.cleanups.pop()?.();
    }
  };

  isRunning = (sessionId: string): boolean => Boolean(this.liveSessions.get(sessionId)?.activeExecution);

  getOrCreateLiveSession = async (
    sessionId: string,
    initialMetadata: Record<string, unknown> = {},
  ): Promise<LiveSession> => this.ensureLiveSession(sessionId, initialMetadata);

  getActiveSessionRun = (sessionId: string): LiveSessionExecution | null =>
    this.liveSessions.get(sessionId)?.activeExecution ?? null;

  getLiveSessionRecord = (sessionId: string) => {
    const session = this.liveSessions.get(sessionId.trim());
    return session ? buildSessionRecord(session, new Date().toISOString()) : null;
  };

  setActiveSessionRun = (
    sessionId: string,
    activeRun: LiveSessionExecution,
  ): void => {
    const session = this.requireLiveSession(sessionId);
    const current = session.activeExecution;
    if (current && current !== activeRun && !current.closed) {
      throw new Error(`Session ${session.sessionId} already has an active execution.`);
    }
    session.activeExecution = activeRun;
    if (current !== activeRun) {
      this.publishSessionRunStatus({ sessionKey: session.sessionId, status: "running" });
    }
  };

  deleteActiveSessionRun = (
    sessionId: string,
    runId: string,
  ): void => {
    const session = this.requireLiveSession(sessionId);
    const current = session.activeExecution;
    if (!current || current.runId !== runId) {
      return;
    }
    current.closed = true;
    session.activeExecution = null;
    this.publishSessionRunStatus({ sessionKey: session.sessionId, status: "idle" });
  };

  streamSessionEvents = (
    payload: NcpStreamRequestPayload,
    options?: NcpAgentRunStreamOptions,
  ): AsyncIterable<NcpEndpointEvent> => {
    this.assertNotDisposed();
    const signal = options?.signal ?? new AbortController().signal;
    const queue = new AsyncEventQueue<NcpEndpointEvent>();
    const stop = () => queue.close();
    const unsubscribe = this.eventBus.on(eventKeys.ncpEvent, (event) => {
      const eventSessionId = readEventSessionId(event);
      if (eventSessionId === payload.sessionId) {
        queue.push(event);
      }
    });
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) {
      stop();
    }
    return (async function* (): AsyncIterable<NcpEndpointEvent> {
      try {
        for await (const event of queue.iterate()) {
          if (signal.aborted) {
            break;
          }
          yield event;
        }
      } finally {
        unsubscribe();
        signal.removeEventListener("abort", stop);
        queue.close();
      }
    })();
  };

  updateToolCallResult: UpdateToolCallResult = async ({
    result,
    sessionId,
    toolCallId,
  }): Promise<void> => {
    this.assertNotDisposed();
    const normalizedSessionId = sessionId.trim();
    const normalizedToolCallId = toolCallId.trim();
    if (!normalizedSessionId || !normalizedToolCallId) {
      return;
    }
    const session = await this.ensureLiveSession(normalizedSessionId);
    await this.publishSessionEvent(session, {
      type: NcpEventType.MessageToolCallResult,
      payload: {
        sessionId: normalizedSessionId,
        toolCallId: normalizedToolCallId,
        content: result,
      },
    });
  };

  updateSessionMetadata = async (
    sessionId: string,
    metadata: Record<string, unknown>,
  ): Promise<boolean> => {
    this.assertNotDisposed();
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) return false;
    const liveSession = this.liveSessions.get(normalizedSessionId) ?? null;
    const storedSession = liveSession ? null : await this.ncpSessionManager.getSessionRecord(normalizedSessionId);
    if (!liveSession && !storedSession) return false;
    if (liveSession) {
      liveSession.metadata = {
        ...liveSession.metadata,
        ...structuredClone(metadata),
      };
    }
    return await this.ncpSessionManager.updateSessionMetadata(normalizedSessionId, metadata);
  };

  appendSessionEvent = async (
    sessionId: string,
    event: NcpEndpointEvent,
    options: PublishSessionEventOptions = {},
  ): Promise<void> => {
    await this.publishSessionEvent(this.requireLiveSession(sessionId), event, options);
  };

  private readonly ensureLiveSession = async (
    sessionId: string,
    initialMetadata: Record<string, unknown> = {},
  ): Promise<LiveSession> => {
    const existing = this.liveSessions.get(sessionId);
    if (existing) {
      if (Object.keys(initialMetadata).length > 0) {
        existing.metadata = {
          ...existing.metadata,
          ...structuredClone(initialMetadata),
        };
      }
      return existing;
    }

    const storedSession = await this.ncpSessionManager.getSessionRecord(sessionId);
    const stateManager = new DefaultNcpAgentConversationStateManager();
    stateManager.hydrate({
      sessionId,
      messages: storedSession?.messages.map((message) => structuredClone(message)) ?? [],
    });
    const metadata = {
      ...(storedSession?.metadata ? structuredClone(storedSession.metadata) : {}),
      ...structuredClone(initialMetadata),
    };
    const session: LiveSession = {
      sessionId,
      ...(readString(storedSession?.agentId) ?? readAgentId(metadata)
        ? { agentId: readString(storedSession?.agentId) ?? readAgentId(metadata) }
        : {}),
      createdAt: storedSession?.createdAt ?? new Date().toISOString(),
      stateManager,
      metadata,
      runtime: null as unknown as NcpAgentRuntime,
      activeExecution: null,
    };
    session.runtime = this.agentRuntimeManager.createRuntime({
      sessionId,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      stateManager,
      sessionMetadata: metadata,
      setSessionMetadata: (nextMetadata) => {
        session.metadata = structuredClone(nextMetadata);
        void this.ncpSessionManager.setSessionMetadata(session.sessionId, session.metadata).catch((error: unknown) => {
          const message = error instanceof Error ? error.stack ?? error.message : String(error);
          console.error(`[session-run] failed to persist runtime metadata for ${session.sessionId}: ${message}`);
        });
      },
      updateSessionMetadata: (nextMetadata) => {
        session.metadata = {
          ...session.metadata,
          ...structuredClone(nextMetadata),
        };
        void this.ncpSessionManager.updateSessionMetadata(session.sessionId, nextMetadata).catch((error: unknown) => {
          const message = error instanceof Error ? error.stack ?? error.message : String(error);
          console.error(`[session-run] failed to persist runtime metadata for ${session.sessionId}: ${message}`);
        });
      },
    });
    this.liveSessions.set(sessionId, session);
    this.cleanups.push(async () => {
      session.activeExecution?.controller.abort();
      await disposeRuntime(session.runtime);
      this.liveSessions.delete(sessionId);
    });
    return session;
  };

  private readonly requireLiveSession = (sessionId: string): LiveSession => {
    const session = this.liveSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} is not live.`);
    }
    return session;
  };

  private readonly publishSessionEvent = async (
    session: LiveSession,
    event: NcpEndpointEvent,
    options: PublishSessionEventOptions = {},
  ): Promise<void> => {
    if (options.dispatchToStateManager !== false) {
      await session.stateManager.dispatch(event);
    }
    if (options.persistSession !== false) {
      await this.persistLiveSessionEvent(session, event);
    }
    this.eventBus.emit(eventKeys.ncpEvent, event, {
      emittedAt: new Date().toISOString(),
      source: "session-run",
    });
  };

  private readonly persistLiveSessionEvent = async (session: LiveSession, event: NcpEndpointEvent): Promise<void> => {
    if (!isDurableSessionEvent(event)) {
      return;
    }
    const updatedAt = new Date().toISOString();
    await this.ncpSessionManager.appendSessionEvent({
      session: {
        sessionId: session.sessionId,
        ...(session.agentId ? { agentId: session.agentId } : {}),
        createdAt: session.createdAt,
        updatedAt,
        metadata: structuredClone(session.metadata),
      },
      event,
      updatedAt,
    });
  };

  private readonly writeLiveSessionMetadata = (
    sessionId: string,
    metadata: Record<string, unknown>,
    mode: "set" | "update",
  ): void => {
    const session = this.liveSessions.get(sessionId);
    if (session) {
      session.metadata = mode === "set"
        ? structuredClone(metadata)
        : { ...session.metadata, ...structuredClone(metadata) };
    }
  };

  private readonly assertNotDisposed = (): void => {
    if (this.disposed) {
      throw new Error("Session run manager has already been disposed.");
    }
  };

  private publishSessionRunStatus = (payload: { sessionKey: string; status: "running" | "idle" }): void => {
    this.eventBus.emit(eventKeys.sessionRunStatus, payload, {
      emittedAt: new Date().toISOString(),
      source: "session-run",
    });
  };
}
