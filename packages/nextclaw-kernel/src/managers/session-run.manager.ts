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
  EventPublisher,
  type AgentSessionStore,
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

export class SessionRunManager {
  private readonly agentRuntimeManager: AgentRuntimeManager;
  private readonly ncpAgentSessionStore: AgentSessionStore;
  private readonly eventBus: EventBus;
  private readonly onSessionUpdated: (sessionKey: string) => void;
  private readonly liveSessions = new Map<string, LiveSession>();
  private readonly publisher = new EventPublisher();
  private disposed = false;

  constructor(options: {
    agentRuntimeManager: AgentRuntimeManager;
    ncpAgentSessionStore: AgentSessionStore;
    eventBus: EventBus;
    onSessionUpdated: (sessionKey: string) => void;
  }) {
    const {
      agentRuntimeManager,
      eventBus,
      ncpAgentSessionStore,
      onSessionUpdated,
    } = options;
    this.agentRuntimeManager = agentRuntimeManager;
    this.ncpAgentSessionStore = ncpAgentSessionStore;
    this.eventBus = eventBus;
    this.onSessionUpdated = onSessionUpdated;
  }

  dispose = async (): Promise<void> => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const session of this.liveSessions.values()) {
      session.activeExecution?.controller.abort();
      session.publisher.close();
      await disposeRuntime(session.runtime);
    }
    this.liveSessions.clear();
    this.publisher.close();
  };

  isRunning = (sessionId: string): boolean => Boolean(this.liveSessions.get(sessionId)?.activeExecution);

  getOrCreateLiveSession = async (
    sessionId: string,
    initialMetadata: Record<string, unknown> = {},
  ): Promise<LiveSession> => this.ensureLiveSession(sessionId, initialMetadata);

  getActiveSessionRun = (sessionId: string): LiveSessionExecution | null =>
    this.liveSessions.get(sessionId)?.activeExecution ?? null;

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
  ): AsyncIterable<NcpEndpointEvent> => (async function* (
    self: SessionRunManager,
  ): AsyncIterable<NcpEndpointEvent> {
    self.assertNotDisposed();
    const signal = options?.signal ?? new AbortController().signal;
    const queue = new AsyncEventQueue<NcpEndpointEvent>();
    const stop = () => queue.close();
    const unsubscribe = self.publisher.subscribe((event) => {
      const eventSessionId = "payload" in event && event.payload && typeof event.payload === "object" &&
        "sessionId" in event.payload && typeof event.payload.sessionId === "string"
        ? event.payload.sessionId
        : null;
      if (eventSessionId === payload.sessionId) {
        queue.push(event);
      }
    });
    const unsubscribeClose = self.liveSessions.get(payload.sessionId)?.publisher.onClose(stop) ?? (() => undefined);
    signal.addEventListener("abort", stop, { once: true });
    try {
      for await (const event of queue.iterate()) {
        if (signal.aborted) {
          break;
        }
        yield event;
      }
    } finally {
      unsubscribe();
      unsubscribeClose();
      signal.removeEventListener("abort", stop);
      queue.close();
    }
  })(this);

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
    await this.onSessionUpdated(normalizedSessionId);
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

    const storedSession = await this.ncpAgentSessionStore.getSession(sessionId);
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
      publisher: new EventPublisher(),
      activeExecution: null,
    };
    session.runtime = this.agentRuntimeManager.createRuntime({
      sessionId,
      ...(session.agentId ? { agentId: session.agentId } : {}),
      stateManager,
      sessionMetadata: metadata,
      setSessionMetadata: (nextMetadata) => {
        session.metadata = structuredClone(nextMetadata);
      },
    });
    this.liveSessions.set(sessionId, session);
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
    this.publisher.publish(event);
    session.publisher.publish(event);
  };

  private readonly persistLiveSessionEvent = async (
    session: LiveSession,
    event: NcpEndpointEvent,
  ): Promise<void> => {
    const updatedAt = new Date().toISOString();
    if (this.ncpAgentSessionStore.appendSessionEvent) {
      await this.ncpAgentSessionStore.appendSessionEvent({
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
      return;
    }
    await this.ncpAgentSessionStore.saveSession(buildSessionRecord(session, updatedAt));
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
