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
  type IngressContext,
} from "@nextclaw/shared";
import {
  type NcpEndpointEvent,
  type NcpMessage,
  type NcpMessageAbortPayload,
  type NcpRunHandle,
} from "@nextclaw/ncp";
import type {
  DiagnosticRuntime,
  LocalExecutionClaimHandle,
  LocalExecutionClaimService,
} from "@nextclaw/core";
import { DIAGNOSTIC_CORRELATION_METADATA_KEY } from "@nextclaw/core";
import type { AgentManager } from "@kernel/managers/agent.manager.js";
import type { AgentContextWindowManager } from "@kernel/managers/agent-context-window.manager.js";
import type { ConfigManager } from "@kernel/managers/config.manager.js";
import type { AgentRuntimeManager } from "./agent-runtime.manager.js";
import { AgentRunSessionCommandManager } from "./agent-run-session-command.manager.js";
import type {
  SessionRun,
  SessionRunActiveRequest,
  SessionRunManager,
} from "./session-run.manager.js";
import { AgentRunInputDeliveryService } from "@kernel/services/agent-run-input-delivery.service.js";
import { AgentRunRequestIdempotencyService } from "@kernel/services/agent-run-request-idempotency.service.js";
import { AgentRuntimeRunObserverService } from "@kernel/services/agent-runtime-run-observer.service.js";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type {
  AgentRunAbortRequest,
  AgentRunAccepted,
  AgentRunRequest,
  AgentRunSpec,
} from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";
import { createUnavailableAiExecutionMetadataEvent } from "@kernel/utils/agent-run-execution-metadata.utils.js";
import {
  attachRunSpecMetadata,
  createMessageSentEvent,
  createSyntheticRunErrorEvent,
  readMessageTask,
  readSessionMaterialization,
  resolveRunSpec,
  toAgentRunRequest,
  toRunHandle,
} from "@kernel/utils/agent-run-request.utils.js";
import {
  createIngressRunTriggerInput,
  createRunTriggerMetadataEvent,
  resolveRunTriggerMetadata,
} from "@kernel/utils/agent-run-trigger.utils.js";

export class AgentRunRequestManager {
  readonly cleanups: Array<() => void> = [];
  private readonly observedSessionRuns = new Set<SessionRun>();
  private readonly sessionCommandManager: AgentRunSessionCommandManager;
  private readonly idempotency: AgentRunRequestIdempotencyService;
  private readonly runtimeRuns: AgentRuntimeRunObserverService;
  readonly pendingInputs: AgentRunInputDeliveryService;
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
    private readonly executionClaims?: LocalExecutionClaimService,
  ) {
    this.pendingInputs = new AgentRunInputDeliveryService(
      agentRuntimeManager,
      sessionManager,
      sessionRunManager,
      this.publishRunQueueUpdated,
    );
    this.idempotency = new AgentRunRequestIdempotencyService(
      sessionManager,
      sessionRunManager,
    );
    this.runtimeRuns = new AgentRuntimeRunObserverService({
      agentRuntimeManager,
      diagnostics,
      eventBus,
    });
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
    this.idempotency.dispose();
    this.sessionCommandManager.dispose();
    this.started = false;
  };

  private handleSendRequest = async (
    envelope: IngressEnvelope<AgentRunSendIngressPayload>,
    context: IngressContext,
  ): Promise<NcpRunHandle> => {
    if (!envelope.payload) {
      throw new Error("Invalid agent run send request.");
    }
    const request = toAgentRunRequest(envelope.payload);
    request.trigger = createIngressRunTriggerInput({
      request,
      source: context.source,
    });
    return toRunHandle(await this.send(request));
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
    return toRunHandle(
      await this.sessionCommandManager.editMessage(envelope.payload),
    );
  };

  private handleContinueRequest = async (
    envelope: IngressEnvelope<AgentRunContinueIngressPayload>,
  ): Promise<NcpRunHandle> => {
    if (!envelope.payload) {
      throw new Error("Invalid agent run continue request.");
    }
    return toRunHandle(
      await this.sessionCommandManager.continueRun(envelope.payload),
    );
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
        trigger: structuredClone(envelope.payload.trigger),
      }),
    );
  };

  private send = async (request: AgentRunRequest): Promise<AgentRunAccepted> =>
    await this.idempotency.accept(request, this.sendOnce);

  private sendOnce = async (
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
    const normalizedRequest: AgentRunRequest = {
      ...request,
      sessionId: session.sessionId,
      message: baseMessage,
    };
    const queuedRequest = sessionRun.enqueueRequest(normalizedRequest, session);
    const steeringRequest =
      request.delivery === "prefer-steer" && sessionRun.isRunning()
        ? this.pendingInputs.promotePreferredSteeringInput(
            sessionRun,
            queuedRequest.id,
            session,
          )
        : null;
    if (steeringRequest) {
      this.publishRunQueueUpdated(session.sessionId);
      return {
        sessionId: session.sessionId,
        userMessageId: steeringRequest.request.message.id,
        runId: steeringRequest.intendedRunId,
        correlationId: request.correlationId,
        delivery: "steered",
      };
    }
    const activeRequest = sessionRun.beginNextRun();
    this.publishRunQueueUpdated(session.sessionId);
    if (activeRequest?.id === queuedRequest.id) {
      await this.startQueuedRun(sessionRun, activeRequest);
    } else if (activeRequest) {
      void this.startQueuedRun(sessionRun, activeRequest).catch(
        () => undefined,
      );
    }

    return {
      sessionId: session.sessionId,
      userMessageId: queuedRequest.request.message.id,
      runId:
        activeRequest?.id === queuedRequest.id ? activeRequest.runId : null,
      correlationId: request.correlationId,
      delivery: activeRequest?.id === queuedRequest.id ? "started" : "queued",
    };
  };

  private startQueuedRun = async (
    sessionRun: SessionRun,
    activeRequest: SessionRunActiveRequest,
  ): Promise<void> => {
    const { request, session } = activeRequest;
    const requestRunStartedAt = new Date().toISOString();
    const { modelSource, spec } = this.resolveQueuedRunSpec(activeRequest);
    const trigger = resolveRunTriggerMetadata({
      request,
      spec,
      startedAt: requestRunStartedAt,
    });
    const executionClaim = await this.claimSessionExecutionOrFail({
      requestRunStartedAt,
      sessionRun,
      spec,
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
      trigger,
    });
    const providerRequest: AgentRunRequest = {
      ...request,
      agentId: spec.agentId,
      sessionId: session.sessionId,
      message,
    };
    const correlationId = request.correlationId ?? activeRequest.runId;
    const parentCorrelationId =
      typeof request.metadata?.[DIAGNOSTIC_CORRELATION_METADATA_KEY] ===
      "string"
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
    const triggerEvent = createRunTriggerMetadataEvent({
      sessionId: session.sessionId,
      spec,
      trigger,
    });
    try {
      await sessionRun.applyEvents([messageSentEvent, triggerEvent]);
      this.publishNcpEvent(messageSentEvent);
      this.publishNcpEvent(triggerEvent);
      const runtime = this.agentRuntimeManager.getOrCreate({
        agentRuntimeId: session.agentRuntimeId,
        session,
        sessionRun,
      });
      const { contextBlocks, tools } =
        await this.agentContextWindowManager.resolveRunSurface(providerRequest);
      this.startRuntimeRun({
        options: {
          contextBlocks,
          initialMessages: [message],
          session,
          sessionRun,
          signal: activeRequest.signal,
          tools,
        },
        requestRunStartedAt,
        runtime,
        spec,
        parentCorrelationId,
        executionClaim,
      });
    } catch (error) {
      this.releaseExecutionClaim(executionClaim);
      const classification = classifyDiagnosticError(
        error,
        activeRequest.signal,
      );
      this.diagnostics?.record({
        domain: "agent.run",
        event:
          classification.outcome === "cancelled"
            ? "run.start.cancelled"
            : "run.start.failed",
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

  private resolveQueuedRunSpec = (
    activeRequest: SessionRunActiveRequest,
  ): ReturnType<typeof resolveRunSpec> => {
    const { request, session } = activeRequest;
    const model =
      request.model ?? session.model ?? this.configManager.getDefaultModel();
    const defaultAgentId = this.agentManager.getDefaultAgentId();
    const agentId = session.agentId ?? request.agentId ?? defaultAgentId;
    const maxToolIterations = this.agentManager.resolveAgentProfileForRun({
      agentId,
      requestMetadata: request.metadata,
      storedAgentId: session.agentId,
    }).maxToolIterations;
    return resolveRunSpec({
      defaultAgentId,
      model,
      modelMaxTokens: this.configManager.getModelMaxTokens(model),
      maxToolIterations,
      request,
      runId: activeRequest.runId,
      session,
    });
  };

  private claimSessionExecutionOrFail = async (params: {
    requestRunStartedAt: string;
    sessionRun: SessionRun;
    spec: AgentRunSpec;
  }): Promise<LocalExecutionClaimHandle<void> | undefined> => {
    const { requestRunStartedAt, sessionRun, spec } = params;
    const acquired = this.executionClaims?.tryAcquire<void>(
      `session:${sessionRun.sessionId}`,
    );
    if (!acquired || acquired.acquired) {
      return acquired?.claim;
    }
    const error = new Error(
      `Session already has an active run owned by another NextClaw process: ${sessionRun.sessionId}`,
    );
    await this.publishRunStartupFailure({
      error,
      requestRunStartedAt,
      sessionRun,
      spec,
    });
    this.startNextQueuedRun(sessionRun);
    throw error;
  };

  private startRuntimeRun = (
    params: Omit<
      Parameters<AgentRuntimeRunObserverService["start"]>[0],
      "onSettled"
    > & { executionClaim?: LocalExecutionClaimHandle<void> },
  ): void => {
    const { executionClaim, ...runtimeParams } = params;
    this.runtimeRuns.start({
      ...runtimeParams,
      onSettled: (sessionRun) => {
        this.releaseExecutionClaim(executionClaim);
        this.startNextQueuedRun(sessionRun);
      },
    });
  };

  private releaseExecutionClaim = (
    claim?: LocalExecutionClaimHandle<void>,
  ): void => {
    if (!claim) {
      return;
    }
    claim.release();
  };

  private publishRunStartupFailure = async (params: {
    error: unknown;
    requestRunStartedAt: string;
    sessionRun: SessionRun;
    spec: AgentRunSpec;
  }): Promise<void> => {
    const { error, requestRunStartedAt, sessionRun, spec } = params;
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
      this.eventBus.emit(
        eventKeys.sessionRunStatus,
        {
          sessionKey: sessionRun.sessionId,
          status,
        },
        {
          emittedAt: new Date().toISOString(),
          source: "agent-run-request",
        },
      );
    });
    this.cleanups.push(() => {
      stop();
      this.observedSessionRuns.delete(sessionRun);
    });
  };

  private publishRunQueueUpdated = (sessionId: string): void => {
    this.eventBus.emit(
      eventKeys.sessionRunQueueUpdated,
      {
        sessionKey: sessionId,
      },
      {
        emittedAt: new Date().toISOString(),
        source: "agent-run-request",
      },
    );
  };

  private publishNcpEvent = (event: NcpEndpointEvent): void => {
    this.eventBus.emit(eventKeys.ncpEvent, event, {
      emittedAt: new Date().toISOString(),
      source: "agent-run-request",
    });
  };

  private getOrCreateSessionForRequest = async (
    request: AgentRunRequest,
  ): Promise<AgentRunSession> => {
    const sessionMaterialization = readSessionMaterialization(
      request.metadata ?? {},
    );
    if (sessionMaterialization && (request.sessionId || request.peerId)) {
      throw new Error(
        "session_materialization requires a new session request.",
      );
    }
    return await this.sessionManager.getOrCreateAgentRunSession({
      sessionId: request.sessionId,
      peerId: request.peerId,
      agentId: request.agentId,
      agentRuntimeId: request.agentRuntimeId,
      channel: request.channel,
      contextInheritance: sessionMaterialization ? {} : undefined,
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
    const aborted =
      sessionRun?.abortRun(request.runId, request.reason) ?? false;
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
