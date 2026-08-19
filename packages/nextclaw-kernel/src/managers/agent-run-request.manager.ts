import {
  classifyDiagnosticError,
  eventKeys,
  ingressKeys,
  type AgentRunContinueIngressPayload,
  type AgentRunEditMessageIngressPayload,
  type AgentRunSendIngressPayload,
  type AgentRunSessionMessageRequestPayload,
  type EventBus,
  type Ingress,
  type IngressEnvelope,
} from "@nextclaw/shared";
import {
  NcpEventType,
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpMessageAbortPayload,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import { catchError, filter, from, lastValueFrom, tap } from "rxjs";
import type { DiagnosticRuntime } from "@nextclaw/core";
import { DIAGNOSTIC_CORRELATION_METADATA_KEY } from "@nextclaw/core";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { AgentContextWindowManager } from "@kernel/managers/agent-context-window.manager.js";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type {
  AgentRuntime,
  AgentRuntimeManager,
  AgentRuntimeRunOptions,
} from "./agent-runtime.manager.js";
import { AgentRunSessionCommandManager } from "./agent-run-session-command.manager.js";
import type {
  SessionRun,
  SessionRunActiveRequest,
  SessionRunManager,
  SessionRunQueuedRequest,
} from "./session-run.manager.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type {
  AgentRunAbortRequest,
  AgentRunAccepted,
  AgentRunRequest,
  AgentRunSpec,
  SessionQueuedInput,
} from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";
import {
  createUnavailableAiExecutionMetadataEvent,
  hasAiExecutionMetadata,
  readAgentRunStartedAt,
} from "@kernel/utils/agent-run-execution-metadata.utils.js";
import {
  attachRunSpecMetadata,
  createCompletedAssistantMessageEvent,
  createMessageSentEvent,
  createSyntheticRunErrorEvent,
  findCompletedAssistantMessage,
  readMessageTask,
  readSessionMaterialization,
  resolveRunSpec,
  toAgentRunRequest,
  toRunHandle,
} from "@kernel/utils/agent-run-request.utils.js";

export class AgentRunRequestManager {
  readonly cleanups: Array<() => void> = [];
  private readonly observedSessionRuns = new Set<SessionRun>();
  private readonly sessionCommandManager: AgentRunSessionCommandManager;
  private started = false;

  constructor(
    private readonly agentRuntimeManager: AgentRuntimeManager,
    private readonly agentManager: AgentManager,
    private readonly configManager: ConfigManager,
    private readonly agentContextWindowManager: AgentContextWindowManager,
    private readonly eventBus: EventBus,
    private readonly ingress: Ingress,
    private readonly sessionManager: SessionManager,
    private readonly sessionRunManager: SessionRunManager,
    private readonly diagnostics?: Pick<DiagnosticRuntime, "record">,
  ) {
    this.sessionCommandManager = new AgentRunSessionCommandManager(
      sessionManager,
      sessionRunManager,
      this.send,
    );
  }

  start = (): void => {
    if (this.started) {
      return;
    }
    this.started = true;
    this.cleanups.push(
      this.ingress.addHandler(
        ingressKeys.agentRun.send,
        this.handleSendRequest,
      ),
      this.ingress.addHandler(
        ingressKeys.agentRun.abort,
        this.handleAbortRequest,
      ),
      this.ingress.addHandler(
        ingressKeys.agentRun.editMessage,
        this.handleEditMessageRequest,
      ),
      this.ingress.addHandler(
        ingressKeys.agentRun.continue,
        this.handleContinueRequest,
      ),
      this.ingress.addHandler(
        ingressKeys.agentRun.sessionMessageRequest,
        this.handleSessionMessageRequest,
      ),
    );
  };

  dispose = (): void => {
    while (this.cleanups.length > 0) {
      this.cleanups.pop()?.();
    }
    this.observedSessionRuns.clear();
    this.sessionCommandManager.dispose();
    this.started = false;
  };

  listQueuedInputs = (sessionId: string): readonly SessionQueuedInput[] => {
    const sessionRun = this.sessionRunManager.getSessionRun(sessionId);
    return sessionRun?.listQueuedRequests().map(this.toQueuedInput) ?? [];
  };

  removeQueuedInput = (
    sessionId: string,
    queuedInputId: string,
  ): SessionQueuedInput | null => {
    const sessionRun = this.sessionRunManager.getSessionRun(sessionId);
    const removed = sessionRun?.removeQueuedRequest(queuedInputId) ?? null;
    if (!removed) {
      return null;
    }
    this.publishRunQueueUpdated(sessionId);
    return this.toQueuedInput(removed);
  };

  private handleSendRequest = async (
    envelope: IngressEnvelope<AgentRunSendIngressPayload>,
  ): Promise<NcpRunHandle> => {
    if (!envelope.payload) {
      throw new Error("Invalid agent run send request.");
    }
    return toRunHandle(await this.send(toAgentRunRequest(envelope.payload)));
  };

  private handleAbortRequest = async (
    envelope: IngressEnvelope<NcpMessageAbortPayload>,
  ): Promise<void> => {
    if (!envelope.payload?.sessionId) {
      throw new Error("Invalid agent run abort request.");
    }
    await this.abort({
      sessionId: envelope.payload.sessionId,
      runId: envelope.payload.runId,
      correlationId: envelope.payload.correlationId,
      reason: envelope.payload.reason,
    });
  };

  private handleEditMessageRequest = async (
    envelope: IngressEnvelope<AgentRunEditMessageIngressPayload>,
  ): Promise<NcpRunHandle> => {
    if (!envelope.payload) {
      throw new Error("Invalid agent run edit-message request.");
    }
    return toRunHandle(await this.sessionCommandManager.editMessage(envelope.payload));
  };

  private handleContinueRequest = async (
    envelope: IngressEnvelope<AgentRunContinueIngressPayload>,
  ): Promise<NcpRunHandle> => {
    if (!envelope.payload) {
      throw new Error("Invalid agent run continue request.");
    }
    return toRunHandle(await this.sessionCommandManager.continueRun(envelope.payload));
  };

  private handleSessionMessageRequest = async (
    envelope: IngressEnvelope<AgentRunSessionMessageRequestPayload>,
  ): Promise<NcpRunHandle> => {
    if (!envelope.payload) {
      throw new Error("Invalid agent run session message request.");
    }
    return toRunHandle(
      await this.send({
        sessionId: envelope.payload.sessionId,
        message: {
          ...envelope.payload.message,
          sessionId: envelope.payload.sessionId,
        },
        correlationId: envelope.payload.requestId,
      }),
    );
  };

  private send = async (
    request: AgentRunRequest,
  ): Promise<AgentRunAccepted> => {
    const session = await this.getOrCreateSessionForRequest(request);
    const sessionRun = await this.sessionRunManager.getOrCreateSessionRun(
      session.sessionId,
    );
    this.observeSessionRun(sessionRun);
    const baseMessage: NcpMessage = {
      ...request.message,
      sessionId: session.sessionId,
    };
    const queuedRequest = sessionRun.enqueueRequest({
      ...request,
      sessionId: session.sessionId,
      message: baseMessage,
    }, session);
    const activeRequest = sessionRun.beginNextRun();
    this.publishRunQueueUpdated(session.sessionId);
    if (activeRequest?.id === queuedRequest.id) {
      await this.startQueuedRun(sessionRun, activeRequest);
    } else if (activeRequest) {
      void this.startQueuedRun(sessionRun, activeRequest).catch(() => undefined);
    }

    return {
      sessionId: session.sessionId,
      userMessageId: queuedRequest.request.message.id,
      runId: activeRequest?.id === queuedRequest.id ? activeRequest.runId : null,
      correlationId: request.correlationId,
    };
  };

  private startQueuedRun = async (
    sessionRun: SessionRun,
    activeRequest: SessionRunActiveRequest,
  ): Promise<void> => {
    const { request, session } = activeRequest;
    const requestRunStartedAt = new Date().toISOString();
    const model = request.model ?? session.model ?? this.configManager.getDefaultModel();
    const { modelSource, spec } = resolveRunSpec({
      defaultAgentId: this.agentManager.getDefaultAgentId(),
      model,
      modelMaxTokens: this.configManager.getModelMaxTokens(model),
      request,
      runId: activeRequest.runId,
      session,
    });
    const message = attachRunSpecMetadata({
      message: {
        ...request.message,
        sessionId: session.sessionId,
        timestamp: requestRunStartedAt,
      },
      modelSource,
      request,
      session,
      spec,
      startedAt: requestRunStartedAt,
    });
    const providerRequest: AgentRunRequest = {
      ...request,
      agentId: spec.agentId,
      sessionId: session.sessionId,
      message,
    };
    const correlationId = request.correlationId ?? activeRequest.runId;
    const parentCorrelationId = typeof request.metadata?.[DIAGNOSTIC_CORRELATION_METADATA_KEY] === "string"
      ? request.metadata[DIAGNOSTIC_CORRELATION_METADATA_KEY]
      : undefined;
    this.diagnostics?.record({
      domain: "agent.run",
      event: "run.started",
      component: "kernel.agent-run-request",
      outcome: "started",
      correlationId,
      parentCorrelationId,
      facts: {
        source: request.channel ? "channel" : "direct",
        ...(request.channel ? { channel: request.channel } : {}),
      },
    });
    const messageSentEvent = createMessageSentEvent({
      sessionId: session.sessionId,
      message,
      correlationId: request.correlationId,
    });
    await sessionRun.applyEvents([messageSentEvent]);
    this.publishNcpEvent(messageSentEvent);
    try {
      const runtime = this.agentRuntimeManager.getOrCreate({
        agentRuntimeId: session.agentRuntimeId,
        session,
        sessionRun,
      });
      const { contextBlocks, tools } =
        await this.agentContextWindowManager.resolveRunSurface(providerRequest);
      sessionRun.inbox.enqueue(message);
      this.startRuntimeRun({
        options: {
          contextBlocks,
          session,
          sessionRun,
          signal: activeRequest.signal,
          tools,
        },
        requestRunStartedAt,
        runtime,
        spec,
        parentCorrelationId,
      });
    } catch (error) {
      const classification = classifyDiagnosticError(error, activeRequest.signal);
      this.diagnostics?.record({
        domain: "agent.run",
        event: classification.outcome === "cancelled" ? "run.start.cancelled" : "run.start.failed",
        component: "kernel.agent-run-request",
        outcome: classification.outcome,
        correlationId,
        parentCorrelationId,
        durationMs: Date.now() - Date.parse(requestRunStartedAt),
        reasonCode: classification.reasonCode,
        providerCode: classification.providerCode,
        facts: classification.facts,
      });
      await this.publishRunStartupFailure({
        error,
        requestRunStartedAt,
        sessionRun,
        spec,
      });
      this.startNextQueuedRun(sessionRun);
      throw error;
    }
  };

  private startRuntimeRun = (params: {
    options: AgentRuntimeRunOptions;
    requestRunStartedAt: string;
    runtime: AgentRuntime;
    spec: AgentRunSpec;
    parentCorrelationId?: string;
  }): void => {
    const { options, parentCorrelationId, requestRunStartedAt, runtime, spec } = params;
    const { session, sessionRun } = options;
    let messageCompletedSeen = false;
    let executionMetadataSeen = false;
    let runtimeFailed = false;
    let runtimeCancelled = false;
    let failureOutcome: "cancelled" | "failed" = "failed";
    let failureReason = "runtime_error";
    let failureProviderCode: string | undefined;
    let failureFacts: Record<string, string | number | boolean | null> | undefined;
    let runStartedAt = requestRunStartedAt;
    void lastValueFrom(
      from(
        runtime.run(spec, options),
      ).pipe(
        filter((event) =>
          event.type !== NcpEventType.MessageSent || event.payload.message.role !== "user",
        ),
        tap((event) => {
          const eventsToPublish: NcpEndpointEvent[] = [];
          if (event.type === NcpEventType.RunError) {
            const classification = classifyDiagnosticError(event.payload.error, options.signal);
            runtimeFailed = true;
            failureOutcome = classification.outcome;
            failureReason = classification.reasonCode === "non_error_thrown"
              || classification.reasonCode === "unexpected_error"
              ? "run_error_event"
              : classification.reasonCode;
            failureProviderCode = classification.providerCode;
            failureFacts = classification.facts;
          }
          if (event.type === NcpEventType.MessageAbort) {
            runtimeCancelled = true;
          }
          if (hasAiExecutionMetadata(event)) {
            executionMetadataSeen = true;
          }
          runStartedAt = readAgentRunStartedAt(event, runStartedAt);
          if (event.type === NcpEventType.MessageCompleted) {
            runtimeCancelled = false;
            messageCompletedSeen = true;
          }
          if (
            event.type === NcpEventType.RunFinished &&
            !messageCompletedSeen
          ) {
            const message = findCompletedAssistantMessage(
              sessionRun.getSnapshot().messages,
              event.payload.messageId,
            );
            if (!message) {
              throw new Error(
                `Run finished without a final assistant message for session "${session.sessionId}".`,
              );
            }
            eventsToPublish.push(createCompletedAssistantMessageEvent({
              sessionId: event.payload.sessionId ?? session.sessionId,
              message,
              correlationId: event.payload.correlationId,
            }));
            messageCompletedSeen = true;
          }
          eventsToPublish.push(event);
          eventsToPublish.forEach(this.publishNcpEvent);
        }),
        catchError(async (error) => {
          const classification = classifyDiagnosticError(error, options.signal);
          runtimeFailed = true;
          failureOutcome = classification.outcome;
          failureReason = classification.reasonCode;
          failureProviderCode = classification.providerCode;
          failureFacts = classification.facts;
          if (!executionMetadataSeen) {
            const metadataEvent = createUnavailableAiExecutionMetadataEvent({
              spec,
              sessionId: session.sessionId,
            });
            await sessionRun.applyEvents([metadataEvent]);
            this.publishNcpEvent(metadataEvent);
          }
          const event = createSyntheticRunErrorEvent({
            error,
            runId: spec.runId,
            sessionId: session.sessionId,
            correlationId: spec.correlationId,
            startedAt: runStartedAt,
          });
          await sessionRun.applyEvents([event]);
          this.publishNcpEvent(event);
        }),
      ),
      { defaultValue: undefined },
    ).finally(async () => {
      this.diagnostics?.record({
        domain: "agent.run",
        event: runtimeFailed
          ? (failureOutcome === "cancelled" ? "run.cancelled" : "run.failed")
          : (runtimeCancelled ? "run.cancelled" : "run.completed"),
        component: "kernel.agent-run-request",
        outcome: runtimeFailed ? failureOutcome : (runtimeCancelled ? "cancelled" : "succeeded"),
        correlationId: spec.correlationId ?? spec.runId,
        parentCorrelationId,
        durationMs: Math.max(0, Date.now() - Date.parse(runStartedAt)),
        reasonCode: runtimeFailed
          ? failureReason
          : (runtimeCancelled ? "operation_cancelled" : undefined),
        providerCode: runtimeFailed ? failureProviderCode : undefined,
        facts: { runtime: session.agentRuntimeId, ...(failureFacts ?? {}) },
      });
      if (runtimeFailed) {
        await this.agentRuntimeManager.disposeRuntime({
          agentRuntimeId: session.agentRuntimeId,
          session,
          sessionRun,
        }).catch(() => undefined);
      }
      this.startNextQueuedRun(sessionRun);
    });
  };

  private publishRunStartupFailure = async (params: {
    error: unknown;
    requestRunStartedAt: string;
    sessionRun: SessionRun;
    spec: AgentRunSpec;
  }): Promise<void> => {
    const {
      error,
      requestRunStartedAt,
      sessionRun,
      spec,
    } = params;
    const metadataEvent = createUnavailableAiExecutionMetadataEvent({
      spec,
      sessionId: sessionRun.sessionId,
    });
    const errorEvent = createSyntheticRunErrorEvent({
      error,
      runId: spec.runId,
      sessionId: sessionRun.sessionId,
      correlationId: spec.correlationId,
      startedAt: requestRunStartedAt,
    });
    await sessionRun.applyEvents([metadataEvent, errorEvent]);
    this.publishNcpEvent(metadataEvent);
    this.publishNcpEvent(errorEvent);
  };

  private startNextQueuedRun = (sessionRun: SessionRun): void => {
    const nextRequest = sessionRun.beginNextRun();
    if (!nextRequest) {
      return;
    }
    this.publishRunQueueUpdated(sessionRun.sessionId);
    void this.startQueuedRun(sessionRun, nextRequest).catch(() => undefined);
  };

  private observeSessionRun = (sessionRun: SessionRun): void => {
    if (this.observedSessionRuns.has(sessionRun)) {
      return;
    }
    this.observedSessionRuns.add(sessionRun);
    const stop = sessionRun.onStatusChange((status) => {
      this.eventBus.emit(eventKeys.sessionRunStatus, {
        sessionKey: sessionRun.sessionId,
        status,
      }, {
        emittedAt: new Date().toISOString(),
        source: "agent-run-request",
      });
    });
    this.cleanups.push(() => {
      stop();
      this.observedSessionRuns.delete(sessionRun);
    });
  };

  private publishRunQueueUpdated = (sessionId: string): void => {
    this.eventBus.emit(eventKeys.sessionRunQueueUpdated, {
      sessionKey: sessionId,
    }, {
      emittedAt: new Date().toISOString(),
      source: "agent-run-request",
    });
  };

  private publishNcpEvent = (event: NcpEndpointEvent): void => {
    this.eventBus.emit(eventKeys.ncpEvent, event, {
      emittedAt: new Date().toISOString(),
      source: "agent-run-request",
    });
  };

  private toQueuedInput = (
    queuedRequest: Pick<SessionRunQueuedRequest, "id" | "enqueuedAt" | "request">,
  ): SessionQueuedInput => ({
    id: queuedRequest.id,
    sessionId: queuedRequest.request.message.sessionId,
    enqueuedAt: queuedRequest.enqueuedAt,
    message: structuredClone(queuedRequest.request.message),
    metadata: structuredClone(queuedRequest.request.metadata ?? {}),
  });

  private getOrCreateSessionForRequest = async (
    request: AgentRunRequest,
  ): Promise<AgentRunSession> => {
    const sessionMaterialization = readSessionMaterialization(
      request.metadata ?? {},
    );
    if (sessionMaterialization && (request.sessionId || request.peerId)) {
      throw new Error("session_materialization requires a new session request.");
    }
    return await this.sessionManager.getOrCreateAgentRunSession({
      sessionId: request.sessionId,
      peerId: request.peerId,
      agentId: request.agentId,
      agentRuntimeId: request.agentRuntimeId,
      channel: request.channel,
      contextInheritance: sessionMaterialization
        ? {}
        : undefined,
      metadata: request.metadata,
      model: request.model,
      parentSessionId: sessionMaterialization?.parentSessionId,
      projectRoot: request.projectRoot,
      sourceSessionId: sessionMaterialization?.parentSessionId,
      task: readMessageTask(request.message),
      thinkingEffort: request.thinkingEffort,
    });
  };

  private abort = async (request: AgentRunAbortRequest): Promise<void> => {
    const sessionRun = this.sessionRunManager.getSessionRun(request.sessionId);
    const aborted = sessionRun?.abortRun(request.runId, request.reason) ?? false;
    this.diagnostics?.record({
      domain: "agent.run",
      event: "abort.requested",
      component: "kernel.agent-run-request",
      outcome: aborted ? "accepted" : "rejected",
      correlationId: request.runId ?? request.correlationId,
      parentCorrelationId: request.correlationId,
      reasonCode: aborted ? undefined : "active_run_not_found",
    });
  };
}
