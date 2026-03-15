import {
  type NcpAgentConversationStateManager,
  type NcpAgentReplayProvider,
  type NcpAgentRuntime,
  type NcpEndpointEvent,
  type NcpEndpointManifest,
  type NcpEndpointSubscriber,
  type NcpMessage,
  type NcpMessageAbortPayload,
  type NcpRequestEnvelope,
  type NcpSessionApi,
  type NcpSessionSummary,
  type NcpStreamRequestPayload,
  NcpEventType,
} from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "./agent-conversation-state-manager.js";

type RuntimeFactoryParams = {
  sessionId: string;
  stateManager: NcpAgentConversationStateManager;
};

export type DefaultNcpInMemoryAgentBackendConfig = {
  createRuntime(params: RuntimeFactoryParams): NcpAgentRuntime;
  endpointId?: string;
  version?: string;
  metadata?: Record<string, unknown>;
  supportedPartTypes?: NcpEndpointManifest["supportedPartTypes"];
  expectedLatency?: NcpEndpointManifest["expectedLatency"];
};

type SessionState = {
  sessionId: string;
  runtime: NcpAgentRuntime;
  stateManager: NcpAgentConversationStateManager;
  activeRunId: string | null;
  updatedAt: string;
  runIds: Set<string>;
};

type RunRecord = {
  runId: string;
  sessionId: string;
  correlationId?: string;
  requestMessageId?: string;
  responseMessageId?: string;
  events: NcpEndpointEvent[];
};

const DEFAULT_SUPPORTED_PART_TYPES: NcpEndpointManifest["supportedPartTypes"] = [
  "text",
  "file",
  "source",
  "step-start",
  "reasoning",
  "tool-invocation",
  "card",
  "rich-text",
  "action",
  "extension",
];

export class DefaultNcpInMemoryAgentBackend
  implements NcpSessionApi, NcpAgentReplayProvider
{
  readonly manifest: NcpEndpointManifest & { endpointKind: "agent" };

  private readonly createRuntime: DefaultNcpInMemoryAgentBackendConfig["createRuntime"];
  private readonly listeners = new Set<NcpEndpointSubscriber>();
  private readonly sessions = new Map<string, SessionState>();
  private readonly runs = new Map<string, RunRecord>();
  private readonly abortControllers = new Map<string, AbortController>();
  private started = false;

  constructor(config: DefaultNcpInMemoryAgentBackendConfig) {
    this.createRuntime = config.createRuntime;
    this.manifest = {
      endpointKind: "agent",
      endpointId: config.endpointId?.trim() || "ncp-in-memory-agent-backend",
      version: config.version?.trim() || "0.1.0",
      supportsStreaming: true,
      supportsAbort: true,
      supportsProactiveMessages: false,
      supportsRunStream: true,
      supportedPartTypes: config.supportedPartTypes ?? DEFAULT_SUPPORTED_PART_TYPES,
      expectedLatency: config.expectedLatency ?? "seconds",
      metadata: config.metadata,
    };
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
    this.publish({ type: NcpEventType.EndpointReady });
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.started = false;
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
  }

  async emit(event: NcpEndpointEvent): Promise<void> {
    await this.ensureStarted();
    switch (event.type) {
      case NcpEventType.MessageRequest:
        await this.handleRequest(event.payload);
        return;
      case NcpEventType.MessageStreamRequest:
        await this.replayToSubscribers(event.payload);
        return;
      case NcpEventType.MessageAbort:
        await this.handleAbort(event.payload);
        return;
      default:
        this.publish(event);
    }
  }

  subscribe(listener: NcpEndpointSubscriber): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async *stream(params: {
    payload: NcpStreamRequestPayload;
    signal: AbortSignal;
  }): AsyncIterable<NcpEndpointEvent> {
    const { payload, signal } = params;
    const record = this.runs.get(payload.runId);
    if (!record || record.sessionId !== payload.sessionId) {
      return;
    }

    const fromIndex = normalizeFromEventIndex(payload.fromEventIndex);
    for (const event of record.events.slice(fromIndex)) {
      if (signal.aborted) {
        break;
      }
      yield cloneValue(event);
    }
  }

  async listSessions(): Promise<NcpSessionSummary[]> {
    return [...this.sessions.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((session) => ({
        sessionId: session.sessionId,
        messageCount: this.readMessages(session).length,
        updatedAt: session.updatedAt,
        status: session.activeRunId ? "running" : "idle",
        activeRunId: session.activeRunId ?? undefined,
      }));
  }

  async listSessionMessages(sessionId: string): Promise<NcpMessage[]> {
    const session = this.sessions.get(sessionId);
    return session ? this.readMessages(session) : [];
  }

  async getSession(sessionId: string): Promise<NcpSessionSummary | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return {
      sessionId,
      messageCount: this.readMessages(session).length,
      updatedAt: session.updatedAt,
      status: session.activeRunId ? "running" : "idle",
      activeRunId: session.activeRunId ?? undefined,
    };
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.activeRunId) {
      this.abortControllers.get(session.activeRunId)?.abort();
      this.abortControllers.delete(session.activeRunId);
    }
    for (const runId of session.runIds) {
      this.runs.delete(runId);
    }
    this.sessions.delete(sessionId);
  }

  private async ensureStarted(): Promise<void> {
    if (!this.started) {
      await this.start();
    }
  }

  private ensureSession(sessionId: string): SessionState {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const stateManager = new DefaultNcpAgentConversationStateManager();
    const session: SessionState = {
      sessionId,
      stateManager,
      runtime: this.createRuntime({ sessionId, stateManager }),
      activeRunId: null,
      updatedAt: now(),
      runIds: new Set<string>(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  private async handleRequest(envelope: NcpRequestEnvelope): Promise<void> {
    const session = this.ensureSession(envelope.sessionId);
    const controller = new AbortController();
    const pendingEvents: NcpEndpointEvent[] = [
      {
        type: NcpEventType.MessageSent,
        payload: {
          sessionId: envelope.sessionId,
          message: cloneValue(envelope.message),
          metadata: envelope.metadata,
        },
      },
    ];
    let runRecord: RunRecord | null = null;

    this.publish(pendingEvents[0]);

    try {
      for await (const event of session.runtime.run(
        {
          sessionId: envelope.sessionId,
          messages: [envelope.message],
          correlationId: envelope.correlationId,
        },
        { signal: controller.signal },
      )) {
        if (event.type === NcpEventType.RunStarted) {
          runRecord = this.openRunRecord(event, envelope, session);
          this.abortControllers.set(runRecord.runId, controller);
          this.appendEvents(runRecord, pendingEvents);
        }

        if (event.type === NcpEventType.RunFinished) {
          const completedEvent = this.createCompletedEvent(session, envelope, runRecord);
          if (completedEvent) {
            await session.stateManager.dispatch(completedEvent);
            this.appendEvents(runRecord, [completedEvent]);
            this.publish(completedEvent);
          }
        }

        this.appendEvents(runRecord, [event]);
        this.publish(event);
        this.touchSession(session, runRecord?.runId ?? null);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        await this.publishFailure(error, envelope, session, runRecord);
      }
    } finally {
      if (runRecord?.runId) {
        this.abortControllers.delete(runRecord.runId);
        if (session.activeRunId === runRecord.runId) {
          session.activeRunId = null;
        }
      }
      this.touchSession(session, session.activeRunId);
    }
  }

  private openRunRecord(
    event: Extract<NcpEndpointEvent, { type: NcpEventType.RunStarted }>,
    envelope: NcpRequestEnvelope,
    session: SessionState,
  ): RunRecord {
    const runId = event.payload.runId?.trim() || `${envelope.sessionId}-${Date.now()}`;
    const record: RunRecord = {
      runId,
      sessionId: envelope.sessionId,
      correlationId: envelope.correlationId,
      requestMessageId: envelope.message.id,
      responseMessageId: event.payload.messageId,
      events: [],
    };
    this.runs.set(runId, record);
    session.runIds.add(runId);
    session.activeRunId = runId;
    return record;
  }

  private async replayToSubscribers(payload: NcpStreamRequestPayload): Promise<void> {
    const signal = new AbortController().signal;
    for await (const event of this.stream({ payload, signal })) {
      this.publish(event);
    }
  }

  private async handleAbort(payload: NcpMessageAbortPayload): Promise<void> {
    const runRecord = this.resolveRunRecord(payload);
    if (!runRecord) {
      return;
    }

    const abortEvent: NcpEndpointEvent = {
      type: NcpEventType.MessageAbort,
      payload: {
        runId: runRecord.runId,
        correlationId: payload.correlationId ?? runRecord.correlationId,
        messageId: payload.messageId ?? runRecord.responseMessageId,
      },
    };

    this.abortControllers.get(runRecord.runId)?.abort();
    this.abortControllers.delete(runRecord.runId);
    this.appendEvents(runRecord, [abortEvent]);

    const session = this.sessions.get(runRecord.sessionId);
    if (session) {
      await session.stateManager.dispatch(abortEvent);
      session.activeRunId = null;
      this.touchSession(session, null);
    }

    this.publish(abortEvent);
  }

  private resolveRunRecord(payload: NcpMessageAbortPayload): RunRecord | null {
    if (payload.runId && this.runs.has(payload.runId)) {
      return this.runs.get(payload.runId) ?? null;
    }

    for (const record of this.runs.values()) {
      if (payload.correlationId && record.correlationId === payload.correlationId) {
        return record;
      }
      if (payload.messageId) {
        const matchesRequest = record.requestMessageId === payload.messageId;
        const matchesResponse = record.responseMessageId === payload.messageId;
        if (matchesRequest || matchesResponse) {
          return record;
        }
      }
    }

    return null;
  }

  private createCompletedEvent(
    session: SessionState,
    envelope: NcpRequestEnvelope,
    runRecord: RunRecord | null,
  ): NcpEndpointEvent | null {
    const streamingMessage = session.stateManager.getSnapshot().streamingMessage;
    if (!streamingMessage) {
      return null;
    }
    if (runRecord?.responseMessageId && streamingMessage.id !== runRecord.responseMessageId) {
      return null;
    }

    return {
      type: NcpEventType.MessageCompleted,
      payload: {
        sessionId: envelope.sessionId,
        correlationId: envelope.correlationId,
        message: {
          ...cloneValue(streamingMessage),
          status: "final",
        },
      },
    };
  }

  private async publishFailure(
    error: unknown,
    envelope: NcpRequestEnvelope,
    session: SessionState,
    runRecord: RunRecord | null,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const messageId = runRecord?.responseMessageId;
    const failedEvent: NcpEndpointEvent = {
      type: NcpEventType.MessageFailed,
      payload: {
        sessionId: envelope.sessionId,
        messageId,
        correlationId: envelope.correlationId,
        error: {
          code: "runtime-error",
          message,
        },
      },
    };
    const runErrorEvent: NcpEndpointEvent = {
      type: NcpEventType.RunError,
      payload: {
        sessionId: envelope.sessionId,
        messageId,
        runId: runRecord?.runId,
        error: message,
      },
    };

    await session.stateManager.dispatch(failedEvent);
    await session.stateManager.dispatch(runErrorEvent);
    this.appendEvents(runRecord, [failedEvent, runErrorEvent]);
    this.publish(failedEvent);
    this.publish(runErrorEvent);
  }

  private readMessages(session: SessionState): NcpMessage[] {
    const snapshot = session.stateManager.getSnapshot();
    const output = snapshot.messages.map((message) => cloneValue(message));
    if (snapshot.streamingMessage) {
      output.push(cloneValue(snapshot.streamingMessage));
    }
    return output;
  }

  private appendEvents(runRecord: RunRecord | null, events: NcpEndpointEvent[]): void {
    if (!runRecord || events.length === 0) {
      return;
    }
    runRecord.events.push(...events.map((event) => cloneValue(event)));
  }

  private touchSession(session: SessionState, activeRunId: string | null): void {
    session.updatedAt = now();
    session.activeRunId = activeRunId;
  }

  private publish(event: NcpEndpointEvent): void {
    for (const listener of this.listeners) {
      listener(cloneValue(event));
    }
  }
}

function now(): string {
  return new Date().toISOString();
}

function normalizeFromEventIndex(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}
