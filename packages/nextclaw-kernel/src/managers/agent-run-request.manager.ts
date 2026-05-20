import { type Config, type SessionManager } from "@nextclaw/core";
import {
  eventKeys,
  ingressKeys,
  type AgentRuntimeSessionMessageIngressPayload,
  type EventBus,
  type Ingress,
  type IngressEnvelope,
} from "@nextclaw/shared";
import type { UpdateToolCallResult } from "@kernel/managers/tool.manager.js";
import {
  isHiddenNcpMessage,
  NcpEventType,
  type NcpAgentRuntime,
  type NcpAgentRunSendOptions,
  type NcpAgentRunStreamOptions,
  type NcpAgentSendEnvelope,
  type NcpEndpointEvent,
  type NcpEndpointSubscriber,
  type NcpMessageAbortPayload,
  type NcpRequestEnvelope,
  type NcpRunHandle,
  type NcpStreamRequestPayload,
} from "@nextclaw/ncp";
import {
  DefaultNcpAgentConversationStateManager,
  EventPublisher,
  type AgentSessionStore,
} from "@nextclaw/ncp-toolkit";
import { ContextCompactionPreflightService } from "@kernel/features/context-compaction/index.js";
import {
  AgentRunSessionApiService,
  AsyncEventQueue,
  buildSessionRecord,
  consumeRunHandle,
  disposeRuntime,
  isTerminalRunEvent,
  type LiveSession,
  type LiveSessionExecution,
  normalizeRunEvent,
  normalizeSendRunEvent,
  type PublishSessionEventOptions,
  readAgentId,
  readMessageTask,
  readMetadataString,
  readString,
  withSession,
} from "@kernel/features/agent-run-request/index.js";
import type { AgentRuntimeManager } from "@kernel/managers/agent-runtime.manager.js";

export type AgentRunRequestManagerOptions = {
  sessions: SessionManager;
  ingress: Ingress;
  agentRuntimeManager: AgentRuntimeManager;
  ncpAgentSessionStore: AgentSessionStore;
  configManager: { loadConfig: () => Config };
  eventBus: EventBus;
  handleNcpEvent: (event: NcpEndpointEvent) => void;
  onSessionUpdated: (sessionKey: string) => void;
};

export class AgentRunRequestManager {
  private readonly cleanups: Array<() => Promise<void> | void> = [];
  private readonly liveSessions = new Map<string, LiveSession>();
  private readonly publisher = new EventPublisher();
  private readonly contextWindowPreview: ContextCompactionPreflightService;
  readonly sessionApi: AgentRunSessionApiService;
  private startPromise: Promise<void> | null = null;
  private disposed = false;
  private started = false;

  constructor(private readonly options: AgentRunRequestManagerOptions) {
    this.contextWindowPreview = new ContextCompactionPreflightService({
      getConfig: options.configManager.loadConfig,
      sessionManager: options.sessions,
    });
    this.sessionApi = new AgentRunSessionApiService({
      liveSessions: this.liveSessions,
      sessionStore: options.ncpAgentSessionStore,
      contextWindowPreview: this.contextWindowPreview,
      onSessionUpdated: options.onSessionUpdated,
    });
  }

  isLiveSessionRunning = (sessionId: string): boolean =>
    this.sessionApi.isLiveSessionRunning(sessionId);

  start = async (): Promise<void> => {
    this.assertNotDisposed();
    if (this.started) {
      return;
    }
    this.startPromise ??= this.startSubscriptions().catch((error: unknown) => {
      this.startPromise = null;
      throw error;
    });
    await this.startPromise;
  };

  dispose = async (): Promise<void> => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    while (this.cleanups.length > 0) {
      await this.cleanups.pop()?.();
    }
    for (const session of this.liveSessions.values()) {
      session.activeExecution?.controller.abort();
      session.publisher.close();
      await disposeRuntime(session.runtime);
    }
    this.liveSessions.clear();
    this.publisher.close();
    this.startPromise = null;
    this.started = false;
  };

  send = async (envelope: NcpAgentSendEnvelope): Promise<NcpRunHandle> => {
    const requestEnvelope = this.materializeSendEnvelope(envelope);
    return await consumeRunHandle(
      this.runMaterializedRequest(requestEnvelope),
      {
        sessionId: requestEnvelope.sessionId,
        userMessageId: requestEnvelope.message.id,
        assistantMessageId: null,
        runId: null,
        ...(requestEnvelope.correlationId ? { correlationId: requestEnvelope.correlationId } : {}),
      },
    );
  };

  updateToolCallResult: UpdateToolCallResult = async ({
    result,
    sessionId,
    toolCallId,
  }): Promise<void> => {
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
    await this.options.onSessionUpdated(normalizedSessionId);
  };

  run = (
    envelope: NcpRequestEnvelope,
    options?: NcpAgentRunSendOptions,
  ): AsyncIterable<NcpEndpointEvent> => this.runMaterializedRequest(envelope, options);

  stream = (
    payload: NcpStreamRequestPayload,
    options?: NcpAgentRunStreamOptions,
  ): AsyncIterable<NcpEndpointEvent> => this.streamSessionEvents(payload, options);

  abort = async (payload: NcpMessageAbortPayload): Promise<void> => {
    const session = this.liveSessions.get(payload.sessionId);
    const execution = session?.activeExecution;
    if (!session || !execution || execution.closed) {
      return;
    }
    execution.abortHandled = true;
    execution.controller.abort();
    await this.publishSessionEvent(session, {
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId: payload.sessionId,
        ...(payload.messageId ? { messageId: payload.messageId } : {}),
      },
    });
    this.finishExecution(session, execution);
  };

  emit = async (event: NcpEndpointEvent): Promise<void> => {
    await this.ensureStarted();
    switch (event.type) {
      case NcpEventType.MessageRequest:
        if (!event.payload.sessionId) {
          throw new Error("MessageRequest requires a sessionId before dispatch.");
        }
        for await (const emittedEvent of this.runMaterializedRequest(withSession(event.payload, event.payload.sessionId))) {
          void emittedEvent;
        }
        return;
      case NcpEventType.MessageAbort:
        await this.abort(event.payload);
        return;
      default:
        this.publishNcpEvent(event);
    }
  };

  subscribe = (listener: NcpEndpointSubscriber): (() => void) =>
    this.publisher.subscribe(listener);

  private readonly startSubscriptions = async (): Promise<void> => {
    this.started = true;
    this.cleanups.push(
      this.options.ingress.addHandler(
        ingressKeys.agentRuntime.sessionMessageRequest,
        this.handleSessionMessageRequest,
      ),
    );
  };

  private readonly runMaterializedRequest = (
    envelope: NcpRequestEnvelope,
    options?: NcpAgentRunSendOptions,
  ): AsyncIterable<NcpEndpointEvent> => (async function* (
    self: AgentRunRequestManager,
  ): AsyncIterable<NcpEndpointEvent> {
    await self.ensureStarted();
    const session = await self.ensureLiveSession(envelope.sessionId, envelope.metadata);
    const execution = self.startExecution(session, envelope, options?.signal);
    let completedMessageSeen = false;

    try {
      if (!isHiddenNcpMessage(envelope.message)) {
        const messageSentEvent: NcpEndpointEvent = {
          type: NcpEventType.MessageSent,
          payload: {
            sessionId: envelope.sessionId,
            message: structuredClone(envelope.message),
            ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
            metadata: envelope.metadata,
          },
        };
        await self.publishSessionEvent(session, messageSentEvent);
        yield messageSentEvent;
      }

      for await (const event of session.runtime.run(
        {
          sessionId: envelope.sessionId,
          messages: [envelope.message],
          correlationId: envelope.correlationId,
          metadata: envelope.metadata,
        },
        { signal: execution.controller.signal },
      )) {
        const normalizedEvent = normalizeSendRunEvent({
          session,
          event: normalizeRunEvent(event, envelope),
          completedMessageSeen,
        });
        completedMessageSeen = normalizedEvent.completedMessageSeen;
        for (const eventToPublish of normalizedEvent.eventsToPublish) {
          await self.publishSessionEvent(session, eventToPublish);
          yield eventToPublish;
        }
      }

      if (execution.controller.signal.aborted && !execution.abortHandled) {
        execution.abortHandled = true;
        const abortEvent: NcpEndpointEvent = {
          type: NcpEventType.MessageAbort,
          payload: { sessionId: session.sessionId },
        };
        await self.publishSessionEvent(session, abortEvent);
        yield abortEvent;
      }
    } catch (error) {
      if (!execution.controller.signal.aborted) {
        const runErrorEvent: NcpEndpointEvent = {
          type: NcpEventType.RunError,
          payload: {
            sessionId: envelope.sessionId,
            ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
            error: error instanceof Error ? error.message : String(error),
          },
        };
        await self.publishSessionEvent(session, runErrorEvent);
        yield runErrorEvent;
      }
    } finally {
      self.finishExecution(session, execution);
      await self.persistLiveSession(session);
    }
  })(this);

  private readonly streamSessionEvents = (
    payload: NcpStreamRequestPayload,
    options?: NcpAgentRunStreamOptions,
  ): AsyncIterable<NcpEndpointEvent> => (async function* (
    self: AgentRunRequestManager,
  ): AsyncIterable<NcpEndpointEvent> {
    await self.ensureStarted();
    const signal = options?.signal ?? new AbortController().signal;
    const queue = new AsyncEventQueue<NcpEndpointEvent>();
    const stop = () => queue.close();
    const unsubscribe = self.subscribe((event) => {
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

  private readonly materializeSendEnvelope = (
    envelope: NcpAgentSendEnvelope,
  ): NcpRequestEnvelope => {
    const existingSessionId = readString(envelope.sessionId) ?? readString(envelope.message.sessionId);
    if (existingSessionId) {
      return withSession(envelope, existingSessionId);
    }

    const metadata = envelope.metadata ?? {};
    const createdSession = this.options.sessions.createSession({
      task: readMessageTask(envelope.message),
      title: readMetadataString(metadata, "label", "title"),
      sourceSessionMetadata: {},
      metadataOverrides: metadata,
      agentId: readMetadataString(metadata, "agent_id", "agentId"),
      model: readMetadataString(metadata, "preferred_model", "model"),
      runtime: readMetadataString(metadata, "runtime", "session_type"),
      sessionType: readMetadataString(metadata, "session_type", "runtime"),
      thinkingLevel: readMetadataString(metadata, "preferred_thinking", "thinking"),
      projectRoot: readMetadataString(metadata, "project_root"),
    });
    this.options.onSessionUpdated(createdSession.sessionId);
    return withSession(envelope, createdSession.sessionId);
  };

  private readonly handleSessionMessageRequest = async (
    envelope: IngressEnvelope<AgentRuntimeSessionMessageIngressPayload>,
  ): Promise<void> => {
    const request = envelope.payload;
    if (!request?.requestId || !request.sessionId || !request.message) {
      throw new Error("Invalid agent run session message request.");
    }
    let terminalEventSeen = false;
    for await (const event of this.runMaterializedRequest({
      sessionId: request.sessionId,
      message: request.message,
      correlationId: request.requestId,
    })) {
      terminalEventSeen ||= isTerminalRunEvent(event);
    }
    if (!terminalEventSeen) {
      throw new Error("Session request completed without a final reply.");
    }
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

    const storedSession = await this.options.ncpAgentSessionStore.getSession(sessionId);
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
    session.runtime = this.options.agentRuntimeManager.createRuntime({
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

  private readonly startExecution = (
    session: LiveSession,
    envelope: NcpRequestEnvelope,
    signal?: AbortSignal,
  ): LiveSessionExecution => {
    if (session.activeExecution && !session.activeExecution.closed) {
      throw new Error(`Session ${session.sessionId} already has an active execution.`);
    }
    const controller = new AbortController();
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    const execution: LiveSessionExecution = {
      controller,
      requestEnvelope: structuredClone(envelope),
      abortHandled: false,
      closed: false,
    };
    session.activeExecution = execution;
    this.publishSessionRunStatus({ sessionKey: session.sessionId, status: "running" });
    return execution;
  };

  private readonly finishExecution = (
    session: LiveSession,
    execution: LiveSessionExecution,
  ): void => {
    execution.closed = true;
    if (session.activeExecution === execution) {
      session.activeExecution = null;
      this.publishSessionRunStatus({ sessionKey: session.sessionId, status: "idle" });
    }
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
    this.publishNcpEvent(event);
    session.publisher.publish(event);
  };

  private readonly persistLiveSession = async (session: LiveSession): Promise<void> => {
    await this.options.ncpAgentSessionStore.saveSession(
      buildSessionRecord(session, new Date().toISOString()),
    );
  };

  private readonly persistLiveSessionEvent = async (
    session: LiveSession,
    event: NcpEndpointEvent,
  ): Promise<void> => {
    const updatedAt = new Date().toISOString();
    if (this.options.ncpAgentSessionStore.appendSessionEvent) {
      await this.options.ncpAgentSessionStore.appendSessionEvent({
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
    await this.options.ncpAgentSessionStore.saveSession(buildSessionRecord(session, updatedAt));
  };

  private readonly ensureStarted = async (): Promise<void> => {
    if (!this.started) {
      await this.start();
    }
  };

  private readonly assertNotDisposed = (): void => {
    if (this.disposed) {
      throw new Error("Agent run request manager has already been disposed.");
    }
  };

  private publishSessionRunStatus = (payload: {
    sessionKey: string;
    status: "running" | "idle";
  }): void => {
    this.options.eventBus.emit(eventKeys.sessionRunStatus, payload, {
      emittedAt: new Date().toISOString(),
      source: "agent-run-request",
    });
  };

  private publishNcpEvent = (event: NcpEndpointEvent): void => {
    this.options.eventBus.emit(eventKeys.ncpEvent, event, {
      emittedAt: new Date().toISOString(),
      source: "agent-run-request",
    });
    this.options.handleNcpEvent(event);
    this.publisher.publish(event);
  };
}
