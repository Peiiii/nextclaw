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
import { NcpErrorException } from "../../errors/ncp-error-exception.js";
import { AgentLiveSessionRegistry } from "./agent-live-session-registry.js";
import { AgentRunExecutor } from "./agent-run-executor.js";
import type { AgentSessionStore, CreateRuntimeFn, LiveSessionExecution, LiveSessionState } from "./agent-backend-types.js";
import { now, readMessages, toLiveSessionSummary, toSessionSummary } from "./agent-backend-session-utils.js";
import { buildPersistedLiveSessionRecord, buildUpdatedSessionRecord } from "./agent-backend-session-persistence.js";
import { updateAgentBackendToolCallResult } from "./agent-backend-update-tool-call-result.js";
import { appendAgentBackendMessage } from "./agent-backend-append-message.js";
import { streamAgentBackendExecution } from "./agent-backend-stream.js";
import { EventPublisher } from "./event-publisher.js";

const DEFAULT_SUPPORTED_PART_TYPES: NcpEndpointManifest["supportedPartTypes"] = ["text", "file", "source", "step-start", "reasoning", "tool-invocation", "card", "rich-text", "action", "extension"];

export type DefaultNcpAgentBackendConfig = {
  createRuntime: CreateRuntimeFn;
  sessionStore: AgentSessionStore;
  onSessionRunStatusChanged?: (payload: { sessionKey: string; status: "running" | "idle" }) => void;
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
  private readonly onSessionRunStatusChanged: ((payload: { sessionKey: string; status: "running" | "idle" }) => void) | undefined;
  private readonly sessionRegistry: AgentLiveSessionRegistry;
  private readonly executor: AgentRunExecutor;
  private readonly publisher: EventPublisher;
  private started = false;

  constructor(config: DefaultNcpAgentBackendConfig) {
    this.sessionStore = config.sessionStore;
    this.onSessionRunStatusChanged = config.onSessionRunStatusChanged;
    this.sessionRegistry = new AgentLiveSessionRegistry(this.sessionStore, config.createRuntime);
    this.executor = new AgentRunExecutor(async (sessionId) => this.persistSession(sessionId));
    this.publisher = new EventPublisher();
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
        continue;
      }
      execution.abortHandled = true;
      execution.controller.abort();
      this.finishSessionExecution(session, execution);
    }
    this.sessionRegistry.clear();
  };

  emit = async (event: NcpEndpointEvent): Promise<void> => {
    await this.ensureStarted();

    switch (event.type) {
      case NcpEventType.MessageRequest:
        await this.handleRequest(event.payload);
        return;
      case NcpEventType.MessageStreamRequest:
        await this.streamToSubscribers(event.payload);
        return;
      case NcpEventType.MessageAbort:
        await this.handleAbort(event.payload);
        return;
      default:
        this.publisher.publish(event);
    }
  };

  subscribe = (listener: (event: NcpEndpointEvent) => void): () => void => {
    return this.publisher.subscribe(listener);
  };

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

      try {
        for await (const event of self.executor.executeRun(
          session,
          envelope,
          execution.controller,
        )) {
          self.publishLiveEvent(execution, event);
          yield event;
        }

        if (execution.controller.signal.aborted && !execution.abortHandled) {
          const abortEvent = await self.createAbortEvent(session.sessionId);
          execution.abortHandled = true;
          self.publishLiveEvent(execution, abortEvent);
          yield abortEvent;
        }
      } finally {
        self.finishSessionExecution(session, execution);
        await self.persistSession(session.sessionId);
      }
    })(this);
  };

  abort = async (payload: NcpMessageAbortPayload): Promise<void> => {
    await this.handleAbort(payload);
  };

  stream = (
    payloadOrParams:
      | NcpStreamRequestPayload
      | { payload: NcpStreamRequestPayload; signal: AbortSignal },
    opts?: NcpAgentRunStreamOptions,
  ): AsyncIterable<NcpEndpointEvent> =>
    streamAgentBackendExecution({
      payloadOrParams,
      opts,
      sessionRegistry: this.sessionRegistry,
    });

  listSessions = async (): Promise<NcpSessionSummary[]> => {
    const storedSessions = await this.sessionStore.listSessions();
    const summaries = storedSessions.map((session) =>
      toSessionSummary(session, this.sessionRegistry.getSession(session.sessionId)),
    );

    for (const liveSession of this.sessionRegistry.listSessions()) {
      if (summaries.some((session) => session.sessionId === liveSession.sessionId)) {
        continue;
      }
      summaries.push(toLiveSessionSummary(liveSession));
    }

    return summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  };

  listSessionMessages = async (sessionId: string): Promise<NcpMessage[]> => {
    const liveSession = this.sessionRegistry.getSession(sessionId);
    if (liveSession) return readMessages(liveSession.stateManager.getSnapshot());
    const session = await this.sessionStore.getSession(sessionId);
    return session ? session.messages.map((message) => structuredClone(message)) : [];
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

  appendMessage = async (sessionId: string, message: NcpMessage): Promise<NcpSessionSummary | null> => {
    await this.ensureStarted();
    return appendAgentBackendMessage({
      sessionId,
      message,
      sessionRegistry: this.sessionRegistry,
      sessionStore: this.sessionStore,
      publisher: this.publisher,
      persistSession: async (nextSessionId) => this.persistSession(nextSessionId),
      getSession: async (nextSessionId) => this.getSession(nextSessionId),
    });
  };

  updateToolCallResult = async (sessionId: string, toolCallId: string, content: unknown): Promise<NcpSessionSummary | null> => {
    await this.ensureStarted();
    return updateAgentBackendToolCallResult({
      sessionId,
      toolCallId,
      content,
      sessionRegistry: this.sessionRegistry,
      publisher: this.publisher,
      persistSession: async (nextSessionId) => this.persistSession(nextSessionId),
      getSession: async (nextSessionId) => this.getSession(nextSessionId),
    });
  };

  updateSession = async (sessionId: string, patch: NcpSessionPatch): Promise<NcpSessionSummary | null> => {
    const liveSession = this.sessionRegistry.getSession(sessionId);
    const storedSession = await this.sessionStore.getSession(sessionId);
    if (!liveSession && !storedSession) return null;
    await this.sessionStore.saveSession(buildUpdatedSessionRecord({
      sessionId,
      patch,
      liveSession,
      storedSession,
      updatedAt: now(),
    }));
    return this.getSession(sessionId);
  };

  deleteSession = async (sessionId: string): Promise<void> => {
    const liveSession = this.sessionRegistry.deleteSession(sessionId);
    const execution = liveSession?.activeExecution;
    if (execution) {
      execution.abortHandled = true;
      execution.controller.abort();
      this.closeExecution(execution);
    }
    await this.sessionStore.deleteSession(sessionId);
  };

  private ensureStarted = async (): Promise<void> => {
    if (!this.started) {
      await this.start();
    }
  };

  private startSessionExecution = (
    session: LiveSessionState,
    envelope: NcpRequestEnvelope,
    signal?: AbortSignal,
  ): LiveSessionExecution => {
    if (session.activeExecution && !session.activeExecution.closed) {
      throw new NcpErrorException(
        "runtime-error",
        `Session ${session.sessionId} already has an active execution.`,
        { sessionId: session.sessionId },
      );
    }

    const controller = new AbortController();
    if (signal) {
      signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    const execution: LiveSessionExecution = {
      controller,
      publisher: new EventPublisher(),
      requestEnvelope: structuredClone(envelope),
      abortHandled: false,
      closed: false,
    };
    session.activeExecution = execution;
    this.onSessionRunStatusChanged?.({ sessionKey: session.sessionId, status: "running" });
    return execution;
  };

  private finishSessionExecution = (
    session: LiveSessionState,
    execution: LiveSessionExecution,
  ): void => {
    if (session.activeExecution === execution) {
      session.activeExecution = null;
      this.onSessionRunStatusChanged?.({ sessionKey: session.sessionId, status: "idle" });
    }
    this.closeExecution(execution);
  };

  private closeExecution = (execution: LiveSessionExecution): void => {
    if (execution.closed) {
      return;
    }
    execution.closed = true;
    execution.publisher.close();
  };

  private publishLiveEvent = (
    execution: LiveSessionExecution,
    event: NcpEndpointEvent,
  ): void => {
    this.publisher.publish(event);
    if (!execution.closed) {
      execution.publisher.publish(event);
    }
  };

  private handleRequest = async (envelope: NcpRequestEnvelope): Promise<void> => {
    for await (const event of this.send(envelope)) {
      void event;
    }
  };

  private streamToSubscribers = async (
    payload: NcpStreamRequestPayload,
  ): Promise<void> => {
    const signal = new AbortController().signal;
    for await (const event of this.stream({ payload, signal })) {
      void event;
    }
  };

  private handleAbort = async (payload: NcpMessageAbortPayload): Promise<void> => {
    const session = this.sessionRegistry.getSession(payload.sessionId);
    const execution = session?.activeExecution;
    if (!session || !execution || execution.closed) {
      return;
    }

    execution.abortHandled = true;
    execution.controller.abort();

    const abortEvent = await this.createAbortEvent(payload.sessionId, payload.messageId);
    this.publishLiveEvent(execution, abortEvent);
    this.finishSessionExecution(session, execution);
  };

  private createAbortEvent = async (
    sessionId: string,
    messageId?: string,
  ): Promise<NcpEndpointEvent> => {
    const abortEvent: NcpEndpointEvent = {
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId,
        ...(messageId ? { messageId } : {}),
      },
    };
    const liveSession = this.sessionRegistry.getSession(sessionId);
    if (liveSession) {
      await liveSession.stateManager.dispatch(abortEvent);
    }
    await this.persistSession(sessionId);
    return abortEvent;
  };

  private persistSession = async (sessionId: string): Promise<void> => {
    const session = this.sessionRegistry.getSession(sessionId);
    if (!session) return;
    await this.sessionStore.saveSession(buildPersistedLiveSessionRecord({
      sessionId,
      session,
      updatedAt: now(),
    }));
  };
}
