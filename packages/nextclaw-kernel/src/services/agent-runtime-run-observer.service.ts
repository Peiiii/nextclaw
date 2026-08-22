import type {
  AgentRuntime,
  AgentRuntimeManager,
  AgentRuntimeRunOptions,
} from "@kernel/managers/agent-runtime.manager.js";
import type { SessionRun } from "@kernel/managers/session-run.manager.js";
import type { AgentRunSpec } from "@kernel/types/agent-run.types.js";
import {
  createUnavailableAiExecutionMetadataEvent,
  hasAiExecutionMetadata,
  readAgentRunStartedAt,
} from "@kernel/utils/agent-run-execution-metadata.utils.js";
import {
  createCompletedAssistantMessageEvent,
  createSyntheticRunErrorEvent,
  findCompletedAssistantMessage,
} from "@kernel/utils/agent-run-request.utils.js";
import type { DiagnosticRuntime } from "@nextclaw/core";
import { NcpEventType, type NcpEndpointEvent } from "@nextclaw/ncp";
import {
  classifyDiagnosticError,
  eventKeys,
  type EventBus,
} from "@nextclaw/shared";
import { catchError, filter, from, lastValueFrom, tap } from "rxjs";

export type AgentRuntimeRunObserverOptions = {
  agentRuntimeManager: AgentRuntimeManager;
  diagnostics?: Pick<DiagnosticRuntime, "record">;
  eventBus: EventBus;
};

export class AgentRuntimeRunObserverService {
  constructor(private readonly options: AgentRuntimeRunObserverOptions) {}

  start = (params: {
    options: AgentRuntimeRunOptions;
    requestRunStartedAt: string;
    runtime: AgentRuntime;
    spec: AgentRunSpec;
    parentCorrelationId?: string;
    onSettled: (sessionRun: SessionRun) => void;
  }): void => {
    const { options, parentCorrelationId, requestRunStartedAt, runtime, spec } =
      params;
    const { session, sessionRun } = options;
    let messageCompletedSeen = false;
    const initialMessageIds = new Set(
      options.initialMessages.map(({ id }) => id),
    );
    let executionMetadataSeen = false;
    let runtimeFailed = false;
    let runtimeCancelled = false;
    let failureOutcome: "cancelled" | "failed" = "failed";
    let failureReason = "runtime_error";
    let failureProviderCode: string | undefined;
    let failureFacts:
      | Record<string, string | number | boolean | null>
      | undefined;
    let runStartedAt = requestRunStartedAt;
    void lastValueFrom(
      from(runtime.run(spec, options)).pipe(
        filter(
          (event) =>
            event.type !== NcpEventType.MessageSent ||
            !initialMessageIds.has(event.payload.message.id),
        ),
        tap((event) => {
          const eventsToPublish: NcpEndpointEvent[] = [];
          const consumedSteeringInput =
            event.type === NcpEventType.MessageSent &&
            event.payload.message.role === "user";
          if (event.type === NcpEventType.RunError) {
            const classification = classifyDiagnosticError(
              event.payload.error,
              options.signal,
            );
            runtimeFailed = true;
            failureOutcome = classification.outcome;
            failureReason =
              classification.reasonCode === "non_error_thrown" ||
              classification.reasonCode === "unexpected_error"
                ? "run_error_event"
                : classification.reasonCode;
            failureProviderCode = classification.providerCode;
            failureFacts = classification.facts;
          }
          if (event.type === NcpEventType.MessageAbort) runtimeCancelled = true;
          if (hasAiExecutionMetadata(event)) executionMetadataSeen = true;
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
            eventsToPublish.push(
              createCompletedAssistantMessageEvent({
                sessionId: event.payload.sessionId ?? session.sessionId,
                message,
                correlationId: event.payload.correlationId,
              }),
            );
            messageCompletedSeen = true;
          }
          eventsToPublish.push(event);
          eventsToPublish.forEach(this.publishNcpEvent);
          if (consumedSteeringInput) {
            this.publishRunQueueUpdated(session.sessionId);
          }
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
    ).finally(() =>
      this.finish({
        failureFacts,
        failureOutcome,
        failureProviderCode,
        failureReason,
        onSettled: params.onSettled,
        parentCorrelationId,
        runStartedAt,
        runtimeCancelled,
        runtimeFailed,
        spec,
        options,
      }),
    );
  };

  private finish = async (input: {
    failureFacts?: Record<string, string | number | boolean | null>;
    failureOutcome: "cancelled" | "failed";
    failureProviderCode?: string;
    failureReason: string;
    onSettled: (sessionRun: SessionRun) => void;
    options: AgentRuntimeRunOptions;
    parentCorrelationId?: string;
    runStartedAt: string;
    runtimeCancelled: boolean;
    runtimeFailed: boolean;
    spec: AgentRunSpec;
  }): Promise<void> => {
    const { session, sessionRun } = input.options;
    this.options.diagnostics?.record({
      domain: "agent.run",
      event: input.runtimeFailed
        ? input.failureOutcome === "cancelled"
          ? "run.cancelled"
          : "run.failed"
        : input.runtimeCancelled
          ? "run.cancelled"
          : "run.completed",
      component: "kernel.agent-run-request",
      outcome: input.runtimeFailed
        ? input.failureOutcome
        : input.runtimeCancelled
          ? "cancelled"
          : "succeeded",
      correlationId: input.spec.correlationId ?? input.spec.runId,
      parentCorrelationId: input.parentCorrelationId,
      durationMs: Math.max(0, Date.now() - Date.parse(input.runStartedAt)),
      reasonCode: input.runtimeFailed
        ? input.failureReason
        : input.runtimeCancelled
          ? "operation_cancelled"
          : undefined,
      providerCode: input.runtimeFailed ? input.failureProviderCode : undefined,
      facts: { runtime: session.agentRuntimeId, ...(input.failureFacts ?? {}) },
    });
    if (input.runtimeFailed) {
      await this.options.agentRuntimeManager
        .disposeRuntime({
          agentRuntimeId: session.agentRuntimeId,
          session,
          sessionRun,
        })
        .catch(() => undefined);
    }
    input.onSettled(sessionRun);
  };

  private publishRunQueueUpdated = (sessionId: string): void => {
    this.options.eventBus.emit(
      eventKeys.sessionRunQueueUpdated,
      { sessionKey: sessionId },
      {
        emittedAt: new Date().toISOString(),
        source: "agent-run-request",
      },
    );
  };

  private publishNcpEvent = (event: NcpEndpointEvent): void => {
    this.options.eventBus.emit(eventKeys.ncpEvent, event, {
      emittedAt: new Date().toISOString(),
      source: "agent-run-request",
    });
  };
}
