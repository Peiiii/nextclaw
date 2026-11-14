import { NCP_RUN_TRIGGER_METADATA_KEY } from "@nextclaw/ncp";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";
import { AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY } from "@kernel/utils/agent-run-metadata.utils.js";
import { resolveSteeringRunTriggerMetadata } from "@kernel/utils/agent-run-trigger.utils.js";

export type SessionRunQueuedRequest = {
  id: string;
  runId: string;
  enqueuedAt: string;
  request: AgentRunRequest;
  session: AgentRunSession;
};

export type SessionRunActiveRequest = SessionRunQueuedRequest & {
  signal: AbortSignal;
};

export type SessionRunPendingRequest = SessionRunQueuedRequest & {
  placement: "queued" | "steering";
  intendedRunId: string | null;
};

type ClaimedNextStepRequest = SessionRunQueuedRequest & {
  intendedRunId: string;
};

/** Single owner for inputs waiting for either the next run or the next safe step. */
export class SessionPendingInputs {
  private readonly nextRun: SessionRunQueuedRequest[] = [];
  private readonly nextStep: ClaimedNextStepRequest[] = [];
  private readonly claimedNextStep = new Map<string, ClaimedNextStepRequest>();

  enqueueNextRun = (request: SessionRunQueuedRequest): void => {
    this.nextRun.push(request);
  };

  enqueueNextStep = (request: SessionRunQueuedRequest, intendedRunId: string): void => {
    this.nextStep.push({ ...request, intendedRunId });
  };

  moveNextRunToNextStep = (
    requestId: string,
    intendedRunId: string,
    activeRunSpec: Record<string, unknown> | null,
  ): SessionRunPendingRequest | null => {
    const index = this.nextRun.findIndex(({ id }) => id === requestId);
    if (index < 0) return null;
    const [request] = this.nextRun.splice(index, 1);
    if (!request) return null;
    const steeringRequest: SessionRunQueuedRequest = {
      ...request,
      request: {
        ...request.request,
        message: {
          ...request.request.message,
          metadata: {
            ...(request.request.message.metadata ?? {}),
            ...(activeRunSpec
              ? { [AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY]: structuredClone(activeRunSpec) }
              : {}),
            [NCP_RUN_TRIGGER_METADATA_KEY]: resolveSteeringRunTriggerMetadata({
              request: request.request,
              targetRunId: intendedRunId,
              acceptedAt: new Date().toISOString(),
            }),
          },
        },
      },
    };
    this.enqueueNextStep(steeringRequest, intendedRunId);
    return this.toPendingRequest(steeringRequest, "steering", intendedRunId);
  };

  list = (): readonly SessionRunPendingRequest[] => [
    ...this.nextStep.map((request) => this.toPendingRequest(
      request,
      "steering",
      request.intendedRunId,
    )),
    ...this.nextRun.map((request) => this.toPendingRequest(request, "queued", null)),
  ];

  listNextRun = (): readonly SessionRunQueuedRequest[] => structuredClone(this.nextRun);

  removeNextRun = (requestId: string): SessionRunQueuedRequest | null => {
    const index = this.nextRun.findIndex(({ id }) => id === requestId);
    if (index < 0) return null;
    const [removed] = this.nextRun.splice(index, 1);
    return removed ? structuredClone(removed) : null;
  };

  shiftNextRun = (): SessionRunQueuedRequest | null => {
    const request = this.nextRun.shift();
    return request ? structuredClone(request) : null;
  };

  claimNextStep = (runId: string): readonly ClaimedNextStepRequest[] => {
    const claimed: ClaimedNextStepRequest[] = [];
    for (let index = this.nextStep.length - 1; index >= 0; index -= 1) {
      const request = this.nextStep[index];
      if (request?.intendedRunId !== runId) continue;
      this.nextStep.splice(index, 1);
      claimed.unshift(request);
    }
    for (const request of claimed) this.claimedNextStep.set(request.id, request);
    return structuredClone(claimed);
  };

  acknowledgeNextStep = (requestIds: readonly string[]): void => {
    for (const requestId of requestIds) this.claimedNextStep.delete(requestId);
  };

  restoreNextStep = (runId: string): void => {
    const restored = [
      ...this.nextStep.filter(({ intendedRunId }) => intendedRunId === runId),
      ...[...this.claimedNextStep.values()].filter(({ intendedRunId }) => intendedRunId === runId),
    ].sort((left, right) => left.enqueuedAt.localeCompare(right.enqueuedAt));
    if (restored.length === 0) return;
    for (let index = this.nextStep.length - 1; index >= 0; index -= 1) {
      if (this.nextStep[index]?.intendedRunId === runId) this.nextStep.splice(index, 1);
    }
    for (const request of restored) this.claimedNextStep.delete(request.id);
    this.nextRun.unshift(...restored.map(({ intendedRunId: _intendedRunId, ...request }) => request));
  };

  get hasNextRun(): boolean {
    return this.nextRun.length > 0;
  }

  clear = (): void => {
    this.nextRun.length = 0;
    this.nextStep.length = 0;
    this.claimedNextStep.clear();
  };

  private toPendingRequest = (
    request: SessionRunQueuedRequest,
    placement: SessionRunPendingRequest["placement"],
    intendedRunId: string | null,
  ): SessionRunPendingRequest => structuredClone({ ...request, placement, intendedRunId });
}

