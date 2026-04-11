import {
  type NcpAgentServerEndpoint,
  type NcpAgentRunApi,
  type NcpAgentRunSendOptions,
  type NcpAgentRunStreamOptions,
  type NcpAgentStreamProvider,
  type NcpEndpointEvent,
  type NcpEndpointManifest,
  type NcpMessage,
  type NcpMessageAbortPayload,
  type NcpRequestEnvelope,
  type NcpSessionApi,
  type NcpSessionPatch,
  type NcpSessionSummary,
  type NcpStreamRequestPayload,
  NcpEventType,
} from "@nextclaw/ncp";
import { AgentLiveSessionRegistry } from "./agent-live-session-registry.js";
import {
  closeAgentBackendSessionExecution,
  finishAgentBackendSessionExecution,
  startAgentBackendSessionExecution,
} from "./agent-backend-execution-utils.js";
import { AgentRunExecutor } from "./agent-run-executor.js";
import { AgentBackendSessionRealtime } from "./agent-backend-session-realtime.js";
import type {
  AgentSessionStore,
  CreateRuntimeFn,
  LiveSessionExecution,
  LiveSessionState,
} from "./agent-backend-types.js";
import {
  normalizeSendRunEvent,
  now,
  readMessages,
  toLiveSessionSummary,
  toSessionSummary,
} from "./agent-backend-session-utils.js";
import {
  buildPersistedLiveSessionRecord,
  buildUpdatedSessionRecord,
} from "./agent-backend-session-persistence.js";
import { EventPublisher } from "./event-publisher.js";

const DEFAULT_SUPPORTED_PART_TYPES: NcpEndpointManifest["supportedPartTypes"] = ["text", "file", "source", "step-start", "reasoning", "tool-invocation", "card", "rich-text", "action", "extension"];

export type DefaultNcpAgentBackendConfig = {
  createRuntime: CreateRuntimeFn;
  sessionStore: AgentSessionStore;
  onSessionRunStatusChanged?: (payload: {
    sessionKey: string;
    status: "running" | "idle";
  }) => void;
  endpointId?: string;
  version?: string;
  metadata?: Record<string, unknown>;
  supportedPartTypes?: NcpEndpointManifest["supportedPartTypes"];
  expectedLatency?: NcpEndpointManifest["expectedLatency"];
};

export class DefaultNcpAgentBackend
  implements
    NcpAgentServerEndpoint,
    NcpSessionApi,
    NcpAgentStreamProvider,
    NcpAgentRunApi
{
  readonly manifest: NcpEndpointManifest & { endpointKind: "agent" };

  private readonly sessionStore: AgentSessionStore;
  private readonly onSessionRunStatusChanged:
    | ((payload: { sessionKey: string; status: "running" | "idle" }) => void)
    | undefined;
  private readonly sessionRegistry: AgentLiveSessionRegistry;
  private readonly executor: AgentRunExecutor;
  private readonly publisher: EventPublisher;
  private readonly sessionRealtime: AgentBackendSessionRealtime;
  private started = false;

  constructor(config: DefaultNcpAgentBackendConfig) {
    this.sessionStore = config.sessionStore;
    this.onSessionRunStatusChanged = config.onSessionRunStatusChanged;
    this.sessionRegistry = new AgentLiveSessionRegistry(
      this.sessionStore,
      config.createRuntime,
    );
    this.executor = new AgentRunExecutor();
    this.publisher = new EventPublisher();
    this.sessionRealtime = new AgentBackendSessionRealtime({
      sessionRegistry: this.sessionRegistry,
      sessionStore: this.sessionStore,
      publishEndpointEvent: (event) => this.publisher.publish(event),
      subscribeEndpointEvent: (listener) => this.publisher.subscribe(listener),
      persistSession: (sessionId) => this.persistSession(sessionId),
      getSessionSummary: (sessionId) => this.getSession(sessionId),
    });
    this.manifest = {
      endpointKind: "agent",
      endpointId: config.endpointId?.trim() || "ncp-agent-backend",
      version: config.version?.trim() || "0.1.0",
      supportsStreaming: true,
      supportsAbort: true,
      supportsProactiveMessages: false,
      supportsLiveSessionStream: true,
      supportedPartTypes:
        config.supportedPartTypes ?? DEFAULT_SUPPORTED_PART_TYPES,
      expectedLatency: config.expectedLatency ?? "seconds",
      metadata: config.metadata,
    };
  }

  start = async (): Promise<void> => {
    if (this.started) {
      return;
    }

    this.started = true;
    this.publisher.publish({ type: NcpEventType.EndpointReady });
  };

  stop = async (): Promise<void> => {
    if (!this.started) {
      return;
    }

    this.started = false;
    for (const session of this.sessionRegistry.listSessions()) {
      const execution = session.activeExecution;
      if (!execution) {
        session.publisher.close();
        continue;
      }
      execution.abortHandled = true;
      execution.controller.abort();
      this.finishSessionExecution(session, execution);
      session.publisher.close();
    }
    this.sessionRegistry.clear();
  };

  emit = async (event: NcpEndpointEvent): Promise<void> => {
    await this.ensureStarted();

    switch (event.type) {
      case NcpEventType.MessageRequest:
        for await (const emittedEvent of this.send(event.payload)) {
          void emittedEvent;
        }
        return;
      case NcpEventType.MessageStreamRequest:
        await this.ensureStarted();
        return;
      case NcpEventType.MessageAbort:
        await this.handleAbort(event.payload);
        return;
      default:
        this.publisher.publish(event);
    }
  };

  subscribe = (listener: (event: NcpEndpointEvent) => void): (() => void) =>
    this.publisher.subscribe(listener);

  send = (
    envelope: NcpRequestEnvelope,
    options?: NcpAgentRunSendOptions,
  ): AsyncIterable<NcpEndpointEvent> => {
    return (async function* (
      self: DefaultNcpAgentBackend,
    ): AsyncIterable<NcpEndpointEvent> {
      await self.ensureStarted();
      const session = await self.sessionRegistry.ensureSession(
        envelope.sessionId,
        envelope.metadata,
      );
      const execution = self.startSessionExecution(
        session,
        envelope,
        options?.signal,
      );
      let completedMessageSeen = false;

      try {
        for await (const event of self.executor.executeRun(
          session,
          envelope,
          execution.controller,
        )) {
          const normalized = normalizeSendRunEvent({
            session,
            event,
            completedMessageSeen,
          });
          completedMessageSeen = normalized.completedMessageSeen;
          for (const normalizedEvent of normalized.eventsToPublish) {
            await self.sessionRealtime.publishSessionEvent(
              session,
              normalizedEvent,
            );
            yield normalizedEvent;
          }
        }

        if (execution.controller.signal.aborted && !execution.abortHandled) {
          const abortEvent: NcpEndpointEvent = {
            type: NcpEventType.MessageAbort,
            payload: {
              sessionId: session.sessionId,
            },
          };
          execution.abortHandled = true;
          await self.sessionRealtime.publishSessionEvent(session, abortEvent, {
            dispatchToStateManager: true,
          });
          yield abortEvent;
        }
      } finally {
        self.finishSessionExecution(session, execution);
        await self.persistSession(session.sessionId);
      }
    })(this);
  };

  abort = async (payload: NcpMessageAbortPayload): Promise<void> => this.handleAbort(payload);

  stream = (
    payloadOrParams:
      | NcpStreamRequestPayload
      | { payload: NcpStreamRequestPayload; signal: AbortSignal },
    opts?: NcpAgentRunStreamOptions,
  ): AsyncIterable<NcpEndpointEvent> =>
    this.sessionRealtime.streamSessionEvents(payloadOrParams, opts);

  listSessions = async (): Promise<NcpSessionSummary[]> => {
    const storedSessions = await this.sessionStore.listSessions();
    const summaries = storedSessions.map((session) =>
      toSessionSummary(
        session,
        this.sessionRegistry.getSession(session.sessionId),
      ),
    );

    for (const liveSession of this.sessionRegistry.listSessions()) {
      if (
        summaries.some((session) => session.sessionId === liveSession.sessionId)
      ) {
        continue;
      }
      summaries.push(toLiveSessionSummary(liveSession));
    }

    return summaries.sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  };

  listSessionMessages = async (sessionId: string): Promise<NcpMessage[]> => {
    const liveSession = this.sessionRegistry.getSession(sessionId);
    if (liveSession) return readMessages(liveSession.stateManager.getSnapshot());
    const session = await this.sessionStore.getSession(sessionId);
    return session
      ? session.messages.map((message) => structuredClone(message))
      : [];
  };

  getSession = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    const liveSession = this.sessionRegistry.getSession(sessionId);
    const storedSession = await this.sessionStore.getSession(sessionId);
    return storedSession
      ? toSessionSummary(storedSession, liveSession)
      : liveSession
        ? toLiveSessionSummary(liveSession)
        : null;
  };

  appendMessage = async (
    sessionId: string,
    message: NcpMessage,
  ): Promise<NcpSessionSummary | null> => {
    await this.ensureStarted();
    return this.sessionRealtime.appendMessage(sessionId, message);
  };

  updateToolCallResult = async (
    sessionId: string,
    toolCallId: string,
    content: unknown,
  ): Promise<NcpSessionSummary | null> => {
    await this.ensureStarted();
    return this.sessionRealtime.updateToolCallResult(
      sessionId,
      toolCallId,
      content,
    );
  };

  updateSession = async (
    sessionId: string,
    patch: NcpSessionPatch,
  ): Promise<NcpSessionSummary | null> => {
    const liveSession = this.sessionRegistry.getSession(sessionId);
    const storedSession = await this.sessionStore.getSession(sessionId);
    if (!liveSession && !storedSession) return null;
    await this.sessionStore.replaceSession(
      buildUpdatedSessionRecord({
        sessionId,
        patch,
        liveSession,
        storedSession,
        updatedAt: now(),
      }),
    );
    return this.getSession(sessionId);
  };

  deleteSession = async (sessionId: string): Promise<void> => {
    const liveSession = this.sessionRegistry.deleteSession(sessionId);
    const execution = liveSession?.activeExecution;
    if (execution) {
      execution.abortHandled = true;
      execution.controller.abort();
      closeAgentBackendSessionExecution(execution);
    }
    liveSession?.publisher.close();
    await this.sessionStore.deleteSession(sessionId);
  };

  private ensureStarted = async (): Promise<void> => {
    if (!this.started) await this.start();
  };

  private startSessionExecution = (
    session: LiveSessionState,
    envelope: NcpRequestEnvelope,
    signal?: AbortSignal,
  ): LiveSessionExecution =>
    startAgentBackendSessionExecution({
      session,
      envelope,
      signal,
      onStatusChanged: this.onSessionRunStatusChanged,
    });

  private finishSessionExecution = (
    session: LiveSessionState,
    execution: LiveSessionExecution,
  ): void =>
    finishAgentBackendSessionExecution({
      session,
      execution,
      onStatusChanged: this.onSessionRunStatusChanged,
    });

  private handleAbort = async (
    payload: NcpMessageAbortPayload,
  ): Promise<void> => {
    const session = this.sessionRegistry.getSession(payload.sessionId);
    const execution = session?.activeExecution;
    if (!session || !execution || execution.closed) {
      return;
    }

    execution.abortHandled = true;
    execution.controller.abort();

    const abortEvent: NcpEndpointEvent = {
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId: payload.sessionId,
        ...(payload.messageId ? { messageId: payload.messageId } : {}),
      },
    };
    await this.sessionRealtime.publishSessionEvent(session, abortEvent, {
      dispatchToStateManager: true,
    });
    this.finishSessionExecution(session, execution);
  };

  private persistSession = async (sessionId: string): Promise<void> => {
    const session = this.sessionRegistry.getSession(sessionId);
    if (!session) return;
    await this.sessionStore.saveSession(
      buildPersistedLiveSessionRecord({
        sessionId,
        session,
        updatedAt: now(),
      }),
    );
  };
}
