import { randomUUID } from "node:crypto";
import {
  ingressKeys,
  type AgentRunSendIngressPayload,
  type AgentRunSessionMessageRequestPayload,
  type Ingress,
  type IngressEnvelope,
} from "@nextclaw/shared";
import {
  isHiddenNcpMessage,
  NcpEventType,
  type NcpAgentRunSendOptions,
  type NcpAgentSendEnvelope,
  type NcpEndpointEvent,
  type NcpMessageAbortPayload,
  type NcpRequestEnvelope,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import {
  consumeRunHandle,
  isTerminalRunEvent,
  type LiveSessionExecution,
  type MaterializedAgentRunRequest,
  normalizeRunEvent,
  normalizeSendRunEvent,
  readMessageTask,
  readMetadataString,
  readString,
  withSession,
} from "@kernel/utils/session-run.utils.js";
import type { SessionRunManager } from "@kernel/managers/session-run.manager.js";
import type { NcpSessionManager } from "@kernel/managers/ncp-session.manager.js";
import {
  resolveEffectiveModel,
  resolveSessionChannelContext,
  syncSessionThinkingPreference,
} from "@kernel/features/native-runtime/index.js";
import type { ContextCompactionManager } from "@kernel/features/context-compaction/index.js";

export class AgentRunRequestManager {
  private readonly contextCompactionManager: ContextCompactionManager;
  private readonly cleanups: Array<() => Promise<void> | void> = [];
  private readonly ingress: Ingress;
  private readonly ncpSessionManager: NcpSessionManager;
  private readonly sessionRunManager: SessionRunManager;
  private disposed = false;
  private started = false;

  constructor(options: {
    contextCompactionManager: ContextCompactionManager;
    ingress: Ingress;
    ncpSessionManager: NcpSessionManager;
    sessionRunManager: SessionRunManager;
  }) {
    const {
      contextCompactionManager,
      ingress,
      ncpSessionManager,
      sessionRunManager,
    } = options;
    this.contextCompactionManager = contextCompactionManager;
    this.ingress = ingress;
    this.ncpSessionManager = ncpSessionManager;
    this.sessionRunManager = sessionRunManager;
  }

  start = (): void => {
    this.assertNotDisposed();
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(
      this.ingress.addHandler(ingressKeys.agentRun.send, this.handleSendRequest),
      this.ingress.addHandler(ingressKeys.agentRun.abort, this.handleAbortRequest),
      this.ingress.addHandler(ingressKeys.agentRun.sessionMessageRequest, this.handleSessionMessageRequest),
    );
  };

  dispose = async (): Promise<void> => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    while (this.cleanups.length > 0) {
      await this.cleanups.pop()?.();
    }
    this.started = false;
  };

  run = (
    envelope: NcpRequestEnvelope,
    options?: NcpAgentRunSendOptions,
  ): AsyncIterable<NcpEndpointEvent> => this.iterateRun(this.materializeRunEnvelope(envelope), options);

  private readonly handleSendRequest = async (
    envelope: IngressEnvelope<AgentRunSendIngressPayload>,
  ): Promise<NcpRunHandle> => {
    if (!envelope.payload) {
      throw new Error("Invalid agent run send request.");
    }
    const requestEnvelope = await this.materializeSendEnvelope(envelope.payload);
    return await consumeRunHandle(
      this.iterateRun(requestEnvelope),
      {
        sessionId: requestEnvelope.sessionId,
        userMessageId: requestEnvelope.message.id,
        assistantMessageId: null,
        runId: requestEnvelope.runId,
        ...(requestEnvelope.correlationId ? { correlationId: requestEnvelope.correlationId } : {}),
      },
    );
  };

  private readonly handleAbortRequest = async (
    envelope: IngressEnvelope<NcpMessageAbortPayload>,
  ): Promise<void> => {
    const payload = envelope.payload;
    if (!payload?.sessionId) {
      throw new Error("Invalid agent run abort request.");
    }
    const activeRun = this.sessionRunManager.getActiveSessionRun(payload.sessionId);
    if (!activeRun || activeRun.closed) {
      return;
    }
    activeRun.abortHandled = true;
    activeRun.controller.abort();
    this.sessionRunManager.setActiveSessionRun(payload.sessionId, activeRun);
    await this.sessionRunManager.appendSessionEvent(payload.sessionId, {
      type: NcpEventType.MessageAbort,
      payload: {
        sessionId: payload.sessionId,
        ...(payload.messageId ? { messageId: payload.messageId } : {}),
      },
    });
    this.sessionRunManager.deleteActiveSessionRun(payload.sessionId, activeRun.runId);
  };

  private readonly iterateRun = async function* (
    this: AgentRunRequestManager,
    envelope: MaterializedAgentRunRequest,
    options?: NcpAgentRunSendOptions,
  ): AsyncIterable<NcpEndpointEvent> {
    const metadata = await this.prepareRunSessionMetadata(envelope.sessionId, envelope.metadata);
    const session = await this.sessionRunManager.getOrCreateLiveSession(envelope.sessionId, metadata);
    const controller = new AbortController();
    options?.signal?.addEventListener("abort", () => controller.abort(), { once: true });
    const activeRun: LiveSessionExecution = {
      runId: envelope.runId,
      controller,
      requestEnvelope: structuredClone(envelope),
      abortHandled: false,
      closed: false,
    };
    this.sessionRunManager.setActiveSessionRun(session.sessionId, activeRun);
    let completedMessageSeen = false;

    try {
      if (!isHiddenNcpMessage(envelope.message)) {
        const messageSentEvent: NcpEndpointEvent = {
          type: NcpEventType.MessageSent,
          payload: {
            sessionId: envelope.sessionId,
            message: structuredClone(envelope.message),
            ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
            metadata,
          },
        };
        await this.sessionRunManager.appendSessionEvent(session.sessionId, messageSentEvent, {
          dispatchToStateManager: false,
        });
        yield messageSentEvent;
      }

      const runtimeInput = {
        sessionId: envelope.sessionId,
        runId: envelope.runId,
        messages: [envelope.message],
        correlationId: envelope.correlationId,
        metadata,
      };
      yield* this.contextCompactionManager.runLivePreflight({
        input: runtimeInput,
        session,
      });
      for await (const event of session.runtime.run(runtimeInput, {
        signal: activeRun.controller.signal,
      })) {
        const normalizedEvent = normalizeSendRunEvent({
          session,
          event: normalizeRunEvent(event, envelope),
          completedMessageSeen,
        });
        completedMessageSeen = normalizedEvent.completedMessageSeen;
        for (const eventToPublish of normalizedEvent.eventsToPublish) {
          await this.sessionRunManager.appendSessionEvent(session.sessionId, eventToPublish, {
            dispatchToStateManager: false,
          });
          yield eventToPublish;
        }
      }

      if (activeRun.controller.signal.aborted && !activeRun.abortHandled) {
        const abortEvent: NcpEndpointEvent = {
          type: NcpEventType.MessageAbort,
          payload: { sessionId: session.sessionId },
        };
        await this.sessionRunManager.appendSessionEvent(session.sessionId, abortEvent);
        yield abortEvent;
      }
    } catch (error) {
      if (!activeRun.controller.signal.aborted) {
        const runErrorEvent: NcpEndpointEvent = {
          type: NcpEventType.RunError,
          payload: {
            sessionId: envelope.sessionId,
            runId: envelope.runId,
            ...(envelope.correlationId ? { correlationId: envelope.correlationId } : {}),
            error: error instanceof Error ? error.message : String(error),
          },
        };
        await this.sessionRunManager.appendSessionEvent(session.sessionId, runErrorEvent);
        yield runErrorEvent;
      }
    } finally {
      this.sessionRunManager.deleteActiveSessionRun(session.sessionId, activeRun.runId);
    }
  };

  private readonly materializeSendEnvelope = async (
    envelope: AgentRunSendIngressPayload,
  ): Promise<MaterializedAgentRunRequest> => {
    const sendEnvelope = this.toNcpSendEnvelope(envelope);
    const existingSessionId = readString(sendEnvelope.sessionId) ?? readString(sendEnvelope.message.sessionId);
    if (existingSessionId) {
      return this.materializeRunEnvelope(withSession(sendEnvelope, existingSessionId));
    }

    const metadata = sendEnvelope.metadata ?? {};
    const createdSession = await this.ncpSessionManager.createSession({
      task: readMessageTask(sendEnvelope.message),
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
    return this.materializeRunEnvelope(withSession(sendEnvelope, createdSession.sessionId));
  };

  private readonly toNcpSendEnvelope = (
    envelope: AgentRunSendIngressPayload,
  ): NcpAgentSendEnvelope => {
    if (Array.isArray(envelope.content)) {
      const { content, ...request } = envelope;
      return {
        ...request,
        message: {
          id: `user-message-${randomUUID()}`,
          role: "user",
          status: "final",
          timestamp: new Date().toISOString(),
          parts: structuredClone(content),
        },
      };
    }
    if ("message" in envelope && envelope.message) {
      return envelope;
    }
    throw new Error("Invalid agent run send request.");
  };

  private readonly materializeRunEnvelope = (envelope: NcpRequestEnvelope): MaterializedAgentRunRequest => ({
    ...envelope,
    runId: `ncp-run-${randomUUID()}`,
  });

  private readonly prepareRunSessionMetadata = async (
    sessionId: string,
    requestMetadata: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> => {
    const storedSession = await this.ncpSessionManager.getSessionRecord(sessionId);
    const currentMetadata = {
      ...(storedSession?.metadata ?? {}),
      ...structuredClone(requestMetadata),
    };
    let nextMetadata = resolveEffectiveModel({
      sessionMetadata: currentMetadata,
      requestMetadata,
      fallbackModel: "",
    }).metadata;
    nextMetadata = syncSessionThinkingPreference({
      sessionMetadata: nextMetadata,
      requestMetadata,
    });
    nextMetadata = resolveSessionChannelContext({
      sessionMetadata: nextMetadata,
      requestMetadata,
    }).metadata;
    await this.sessionRunManager.updateSessionMetadata(sessionId, nextMetadata);
    return nextMetadata;
  };

  private readonly handleSessionMessageRequest = async (
    envelope: IngressEnvelope<AgentRunSessionMessageRequestPayload>,
  ): Promise<void> => {
    const request = envelope.payload;
    if (!request?.requestId || !request.sessionId || !request.message) {
      throw new Error("Invalid agent run session message request.");
    }
    let terminalEventSeen = false;
    for await (const event of this.run({
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

  private readonly assertNotDisposed = (): void => {
    if (this.disposed) {
      throw new Error("Agent run request manager has already been disposed.");
    }
  };
}
