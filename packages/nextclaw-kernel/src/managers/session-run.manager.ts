import { randomUUID } from "node:crypto";
import {
  NCP_RUN_TRIGGER_METADATA_KEY,
  NcpEventType,
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager, insertMessageByTimeline } from "@nextclaw/ncp-toolkit";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";
import type {
  ProductActivitySink,
  ProductActivitySource,
} from "@kernel/types/product-activity.types.js";
import {
  recordProductActivityBestEffort,
  resolveHumanProductActivitySource,
} from "@kernel/utils/product-activity.utils.js";
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
class SessionPendingInputs {
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

function isConversationStateEvent(event: NcpEndpointEvent): boolean {
  return event.type !== NcpEventType.ContextWindowUpdated;
}

function findRunSpec(
  messages: readonly NcpMessage[],
  runId: string,
): Record<string, unknown> | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const runSpec = messages[index]?.metadata?.[AGENT_RUN_MESSAGE_RUN_SPEC_METADATA_KEY];
    if (
      runSpec &&
      typeof runSpec === "object" &&
      !Array.isArray(runSpec) &&
      (runSpec as Record<string, unknown>).runId === runId
    ) {
      return runSpec as Record<string, unknown>;
    }
  }
  return null;
}

export class SessionRun {
  readonly sessionId: string;
  private readonly statusListeners = new Set<(status: "idle" | "running") => void>();
  private readonly pendingInputs = new SessionPendingInputs();
  private activeRunId: string | null = null;
  private activeRunController: AbortController | null = null;
  private activeProductActivitySource: ProductActivitySource | null = null;

  constructor(
    seed: {
      sessionId: string;
      messages: readonly NcpMessage[];
    },
    private readonly stateManager: NcpAgentConversationStateManager = new DefaultNcpAgentConversationStateManager(),
    private readonly productActivitySink?: ProductActivitySink,
  ) {
    this.sessionId = seed.sessionId;
    this.stateManager.hydrate({
      sessionId: seed.sessionId,
      messages: seed.messages,
    });
  }

  getSnapshot = (): { messages: readonly NcpMessage[] } => {
    const snapshot = this.stateManager.getSnapshot();
    return {
      messages: snapshot.streamingMessage ? insertMessageByTimeline(snapshot.messages, snapshot.streamingMessage) : snapshot.messages,
    };
  };

  applyEvents = async (events: readonly NcpEndpointEvent[]): Promise<void> => {
    this.applyRunEvents(events);
    const conversationEvents = events.filter(isConversationStateEvent);
    if (conversationEvents.length > 0) {
      await this.stateManager.dispatchBatch(conversationEvents);
    }
  };

  replaceMessages = (messages: readonly NcpMessage[]): void => {
    if (this.isBusy()) {
      throw new Error(`Cannot replace messages while session is running: ${this.sessionId}`);
    }
    this.stateManager.hydrate({
      sessionId: this.sessionId,
      messages,
    });
  };

  onStatusChange = (
    listener: (status: "idle" | "running") => void,
  ): (() => void) => {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  };

  enqueueRequest = (
    request: AgentRunRequest,
    session: AgentRunSession,
  ): SessionRunQueuedRequest => {
    const wasBusy = this.isBusy();
    const queuedRequest: SessionRunQueuedRequest = {
      id: `queued-input-${randomUUID()}`,
      runId: `agent-run-${randomUUID()}`,
      enqueuedAt: new Date().toISOString(),
      request: structuredClone(request),
      session: structuredClone(session),
    };
    this.pendingInputs.enqueueNextRun(queuedRequest);
    this.emitStatusChangeIfNeeded(wasBusy);
    return structuredClone(queuedRequest);
  };

  listQueuedRequests = (): readonly SessionRunQueuedRequest[] =>
    this.pendingInputs.listNextRun();

  listPendingRequests = (): readonly SessionRunPendingRequest[] =>
    this.pendingInputs.list();

  removeQueuedRequest = (queuedRequestId: string): SessionRunQueuedRequest | null => {
    const wasBusy = this.isBusy();
    const removed = this.pendingInputs.removeNextRun(queuedRequestId);
    this.emitStatusChangeIfNeeded(wasBusy);
    return removed;
  };

  moveQueuedRequestToNextStep = (queuedRequestId: string): SessionRunPendingRequest | null => {
    if (!this.activeRunId) return null;
    return this.pendingInputs.moveNextRunToNextStep(
      queuedRequestId,
      this.activeRunId,
      findRunSpec(this.getSnapshot().messages, this.activeRunId),
    );
  };

  claimNextStepRequests = (runId: string): readonly SessionRunPendingRequest[] =>
    this.pendingInputs.claimNextStep(runId).map((request) => ({
      ...request,
      placement: "steering" as const,
      intendedRunId: runId,
    }));

  acknowledgeNextStepRequests = (requestIds: readonly string[]): void => {
    this.pendingInputs.acknowledgeNextStep(requestIds);
  };

  getActiveRunId = (): string | null => this.activeRunId;

  beginNextRun = (): SessionRunActiveRequest | null => {
    if (this.activeRunId) {
      return null;
    }
    const wasBusy = this.isBusy();
    const queuedRequest = this.pendingInputs.shiftNextRun();
    if (!queuedRequest) {
      return null;
    }
    const controller = new AbortController();
    this.activeRunId = queuedRequest.runId;
    this.activeRunController = controller;
    this.activeProductActivitySource = resolveHumanProductActivitySource(queuedRequest.request);
    if (this.activeProductActivitySource) {
      recordProductActivityBestEffort(this.productActivitySink, {
        kind: "intent_accepted",
        occurredAt: new Date().toISOString(),
        source: this.activeProductActivitySource,
      });
    }
    this.emitStatusChangeIfNeeded(wasBusy);
    return {
      ...structuredClone(queuedRequest),
      signal: controller.signal,
    };
  };

  abortRun = (runId?: string, reason?: unknown): boolean => {
    if (!this.activeRunId || !this.activeRunController) {
      return false;
    }
    if (runId && this.activeRunId !== runId) {
      return false;
    }
    this.activeRunController.abort(reason);
    return true;
  };

  isRunning = (): boolean => this.activeRunId !== null;

  isBusy = (): boolean => this.isRunning() || this.pendingInputs.hasNextRun;

  dispose = (): void => {
    const wasBusy = this.isBusy();
    this.activeRunController?.abort({
      code: "abort-error",
      message: "Session run owner was disposed; the current run was cancelled.",
      details: { source: "session-run-manager" },
    });
    this.activeRunController = null;
    this.activeRunId = null;
    this.activeProductActivitySource = null;
    this.pendingInputs.clear();
    this.emitStatusChangeIfNeeded(wasBusy);
    this.statusListeners.clear();
  };

  private applyRunEvents = (events: readonly NcpEndpointEvent[]): void => {
    const wasBusy = this.isBusy();
    for (const event of events) {
      if (event.type === NcpEventType.RunStarted && event.payload.runId) {
        this.activeRunId = event.payload.runId;
      }
      if (
        (event.type === NcpEventType.MessageAbort ||
          event.type === NcpEventType.RunFinished ||
          event.type === NcpEventType.RunError) &&
        (!event.payload.runId || event.payload.runId === this.activeRunId)
      ) {
        if (
          event.type === NcpEventType.RunFinished
          && this.activeProductActivitySource
        ) {
          recordProductActivityBestEffort(this.productActivitySink, {
            kind: "run_succeeded",
            occurredAt: new Date().toISOString(),
            source: this.activeProductActivitySource,
          });
        }
        if (this.activeRunId) this.pendingInputs.restoreNextStep(this.activeRunId);
        this.activeRunId = null;
        this.activeRunController = null;
        this.activeProductActivitySource = null;
      }
    }
    this.emitStatusChangeIfNeeded(wasBusy);
  };

  private emitStatusChangeIfNeeded = (
    wasBusy: boolean,
  ): void => {
    const busy = this.isBusy();
    if (busy === wasBusy) {
      return;
    }
    for (const listener of [...this.statusListeners]) {
      listener(busy ? "running" : "idle");
    }
  };
}

export class SessionRunManager {
  private readonly runs = new Map<string, SessionRun>();
  private readonly pendingCreations = new Map<string, Promise<SessionRun>>();

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly productActivitySink?: ProductActivitySink,
  ) {}

  getSessionRun = (sessionId: string): SessionRun | null =>
    this.runs.get(sessionId) ?? null;

  isSessionRunning = (sessionId: string): boolean => this.runs.get(sessionId.trim())?.isBusy() ?? false;

  getOrCreateSessionRun = async (sessionId: string): Promise<SessionRun> => {
    const existing = this.getSessionRun(sessionId);
    if (existing) {
      return existing;
    }
    const pending = this.pendingCreations.get(sessionId);
    if (pending) {
      return await pending;
    }
    const creation = this.createSessionRun(sessionId).finally(() => {
      this.pendingCreations.delete(sessionId);
    });
    this.pendingCreations.set(sessionId, creation);
    return await creation;
  };

  createSessionRun = async (sessionId: string): Promise<SessionRun> => {
    if (this.runs.has(sessionId)) {
      throw new Error(`Session run already exists: ${sessionId}`);
    }
    const messages = await this.sessionManager.listSessionMessages(sessionId);
    const seed = {
      messages,
      sessionId,
    };
    const run = new SessionRun(seed, undefined, this.productActivitySink);
    this.runs.set(sessionId, run);
    return run;
  };

  deleteSessionRun = (sessionId: string): boolean => {
    const run = this.runs.get(sessionId);
    if (!run) {
      return false;
    }
    run.dispose();
    return this.runs.delete(sessionId);
  };

  dispose = (): void => {
    for (const run of this.runs.values()) {
      run.dispose();
    }
    this.runs.clear();
    this.pendingCreations.clear();
  };
}
