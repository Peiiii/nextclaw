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
import { AgentLiveSessionRegistry } from "./agent-live-session-registry.service.js";
import {
  finishAgentBackendSessionExecution,
  startAgentBackendSessionExecution,
} from "./agent-backend-execution.utils.js";
import { AgentRunExecutor } from "./agent-run-executor.service.js";
import { AgentBackendSessionRealtime } from "./agent-backend-session-realtime.service.js";
import type {
  AgentSessionStore,
  CreateRuntimeFn,
  LiveSessionExecution,
  LiveSessionState,
} from "./agent-backend.types.js";
import {
  getBackendSessionSummary,
  listBackendSessionMessages,
  listBackendSessionSummaries,
  normalizeSendRunEvent,
  now,
  type SessionContextWindowResolver,
} from "./agent-backend-session.utils.js";
import {
  persistLiveSession,
  persistLiveSessionEvent,
  shouldPersistRunEndSnapshot,
} from "./agent-backend-session-persistence.utils.js";
import { EventPublisher } from "./event-publisher.js";

const DEFAULT_SUPPORTED_PART_TYPES: NcpEndpointManifest["supportedPartTypes"] = ["text", "file", "source", "step-start", "reasoning", "tool-invocation", "card", "rich-text", "action", "extension"];

type DisposableRuntime = { dispose?: () => Promise<void> | void };

const disposeRuntime = async (runtime: LiveSessionState["runtime"]): Promise<void> => {
  await (runtime as DisposableRuntime).dispose?.();
};

function buildUpdatedMetadata(params: {
  liveSession: LiveSessionState | null;
  patch: NcpSessionPatch;
  storedSession: Awaited<ReturnType<AgentSessionStore["getSession"]>>;
}): Record<string, unknown> {
  const { liveSession, patch, storedSession } = params;
  if (patch.metadata === null) {
    return {};
  }
  if (patch.metadata) {
    return structuredClone(patch.metadata);
  }
  return structuredClone(liveSession?.metadata ?? storedSession?.metadata ?? {});
}

export type DefaultNcpAgentBackendConfig = {
  createRuntime: CreateRuntimeFn;
  sessionStore: AgentSessionStore;
  resolveSessionContextWindow?: SessionContextWindowResolver;
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
  private readonly resolveSessionContextWindow: DefaultNcpAgentBackendConfig["resolveSessionContextWindow"];
  private started = false;
  constructor(config: DefaultNcpAgentBackendConfig) {
    this.sessionStore = config.sessionStore;
    this.resolveSessionContextWindow = config.resolveSessionContextWindow;
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
      persistSession: (sessionId) =>
        persistLiveSession({
          sessionStore: this.sessionStore,
          session: this.sessionRegistry.getSession(sessionId),
          sessionId,
          updatedAt: now(),
        }),
      persistSessionEvent: (session, event) =>
        persistLiveSessionEvent({
          sessionStore: this.sessionStore,
          session,
          event,
          updatedAt: now(),
        }),
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
        await disposeRuntime(session.runtime);
        continue;
      }
      execution.abortHandled = true;
      execution.controller.abort();
      this.finishSessionExecution(session, execution);
      session.publisher.close();
      await disposeRuntime(session.runtime);
    }
    this.sessionRegistry.clear();
  };

  emit = async (event: NcpEndpointEvent): Promise<void> => {
    await this.ensureStarted();

    switch (event.type) {
      case NcpEventType.MessageRequest:
        if (!event.payload.sessionId) {
          throw new Error("MessageRequest requires a sessionId before it reaches the agent backend.");
        }
        for await (const emittedEvent of this.send({
          ...event.payload,
          sessionId: event.payload.sessionId,
          message: {
            ...event.payload.message,
            sessionId: event.payload.sessionId,
          },
        })) {
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
        if (shouldPersistRunEndSnapshot(self.sessionStore)) {
          await persistLiveSession({
            sessionStore: self.sessionStore,
            session,
            sessionId: session.sessionId,
            updatedAt: now(),
          });
        }
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
    return listBackendSessionSummaries({
      sessionStore: this.sessionStore,
      liveSessions: this.sessionRegistry.listSessions(),
    });
  };

  isLiveSessionRunning = (sessionId: string): boolean => Boolean(this.sessionRegistry.getSession(sessionId)?.activeExecution);

  listSessionMessages = async (sessionId: string): Promise<NcpMessage[]> => {
    return listBackendSessionMessages({
      sessionStore: this.sessionStore,
      liveSession: this.sessionRegistry.getSession(sessionId),
      sessionId,
    });
  };

  getSession = async (sessionId: string): Promise<NcpSessionSummary | null> => {
    return getBackendSessionSummary({
      sessionStore: this.sessionStore,
      liveSession: this.sessionRegistry.getSession(sessionId),
      sessionId,
      resolveSessionContextWindow: this.resolveSessionContextWindow,
    });
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
    const metadata = buildUpdatedMetadata({ liveSession, patch, storedSession });
    const updatedAt = now();
    if (liveSession) {
      liveSession.metadata = structuredClone(metadata);
    }
    await this.sessionStore.updateSessionMetadata({
      sessionId,
      metadata,
      updatedAt,
    });
    return this.getSession(sessionId);
  };

  deleteSession = async (sessionId: string): Promise<void> => {
    const liveSession = this.sessionRegistry.deleteSession(sessionId);
    const execution = liveSession?.activeExecution;
    if (execution) {
      execution.abortHandled = true;
      execution.controller.abort();
      execution.closed = true;
    }
    liveSession?.publisher.close();
    if (liveSession) {
      await disposeRuntime(liveSession.runtime);
    }
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

}
