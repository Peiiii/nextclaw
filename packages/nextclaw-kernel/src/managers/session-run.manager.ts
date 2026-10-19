import {
  NCP_RUN_TRIGGER_METADATA_KEY,
  NcpEventType,
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager, insertMessageByTimeline } from "@nextclaw/ncp-toolkit";
import { MODEL_ROUND_PART_OFFSETS } from "@nextclaw/ncp-agent-runtime";
import type { AgentRunSessionHost } from "@kernel/types/agent-run-host.types.js";
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
import { buildContextCompactionTimelineNcpMessage, buildContextCompactionModelProjection, CONTEXT_COMPACTION_PART_START, readLatestContextCompactionCheckpoint, readContextRecoveryState } from "@kernel/features/context-compaction/utils/context-compaction.utils.js";
import { COMPACTION_RECOVERY_NOTICE } from "@kernel/features/context-compaction/services/context-compaction-summary-generation.service.js";
import type { ContextCompactionCheckpoint } from "@nextclaw/core/context-compaction";
import type { SessionManager } from "./session.manager.js";
import { buildSessionMessageDescriptor, buildSessionValuePreview, sessionJsonFragments, SESSION_RUN_BYTES } from "@kernel/utils/session-message-chunks.utils.js";

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
  private eventChain: Promise<void> = Promise.resolve();
  private windowGrowthBytes = 0;

  constructor(
    seed: {
      sessionId: string;
      messages: readonly NcpMessage[];
    },
    private readonly stateManager: NcpAgentConversationStateManager = new DefaultNcpAgentConversationStateManager(),
    private readonly productActivitySink?: ProductActivitySink,
    private readonly persistCompaction?: (event: NcpEndpointEvent, signal?: AbortSignal) => Promise<void>,
  ) {
    this.sessionId = seed.sessionId;
    this.stateManager.hydrate({
      sessionId: seed.sessionId,
      messages: seed.messages,
    });
    for (const fragment of sessionJsonFragments(seed.messages)) this.windowGrowthBytes += Buffer.byteLength(fragment);
  }

  getSnapshot = (): { messages: readonly NcpMessage[] } => {
    const snapshot = this.stateManager.getSnapshot();
    return {
      messages: snapshot.streamingMessage ? insertMessageByTimeline(snapshot.messages, snapshot.streamingMessage) : snapshot.messages,
    };
  };
  getContextRecoveryState = () => readContextRecoveryState(this.getSnapshot().messages);

  applyEvents = (events: readonly NcpEndpointEvent[], options?: { signal?: AbortSignal }): Promise<void> => {
    const operation = this.eventChain.then(() => this.applyEventsNow(events, options?.signal));
    this.eventChain = operation.catch(() => undefined);
    return operation;
  };

  private applyEventsNow = async (events: readonly NcpEndpointEvent[], signal?: AbortSignal): Promise<void> => {
    for (const event of events) {
      if (event.type === NcpEventType.MessageSent && event.payload.message.metadata?.nextclaw_timeline_kind === "context_compaction"
        && (event.payload.message.metadata.checkpoint as { status?: string } | undefined)?.status === "compressed") await this.persistCompaction?.(event, signal);
    }
    this.applyRunEvents(events);
    let archived = false;
    const conversationEvents = events.filter(isConversationStateEvent).map(event => {
      let bytes = 0;
      for (const fragment of sessionJsonFragments(event)) { bytes += Buffer.byteLength(fragment); if (bytes > 64 * 1024) break; }
      this.windowGrowthBytes += bytes;
      if (bytes <= 64 * 1024) return event;
      archived = true;
      if (event.type === NcpEventType.MessageSent || event.type === NcpEventType.MessageCompleted) {
        return { ...event, payload: { ...event.payload, message: this.archiveMessageView(event.payload.message) } };
      }
      return "payload" in event ? { ...event, payload: buildSessionValuePreview(event.payload) } as NcpEndpointEvent : event;
    });
    if (conversationEvents.length > 0) {
      await this.stateManager.dispatchBatch(conversationEvents);
    }
    const snapshot = this.getSnapshot();
    if (archived || this.windowGrowthBytes > SESSION_RUN_BYTES || snapshot.messages.length > 256
      || snapshot.messages.reduce((count, message) => count + message.parts.length, 0) > 1_024) await this.archiveWindow();
    const compressed = [...events].reverse().find(event => event.type === NcpEventType.MessageSent
      && event.payload.message.metadata?.nextclaw_timeline_kind === "context_compaction"
      && (event.payload.message.metadata.checkpoint as { status?: string } | undefined)?.status === "compressed");
    if (compressed?.type === NcpEventType.MessageSent) await this.retainCompactedView(compressed.payload.message);
  };

  private archiveMessageView = (message: NcpMessage): NcpMessage => {
    const base = Number(message.metadata?.[CONTEXT_COMPACTION_PART_START] ?? 0);
    const start = message.role === "assistant" ? Math.max(0, message.parts.length - 16) : 0;
    const descriptor = buildSessionMessageDescriptor({ ...message, parts: message.parts.slice(start, start + 16) }, "runtime");
    const offsets = message.metadata?.[MODEL_ROUND_PART_OFFSETS];
    return { ...descriptor, metadata: { ...descriptor.metadata, nextclaw_archived_body: true,
      ...(Array.isArray(offsets) ? { [MODEL_ROUND_PART_OFFSETS]: offsets.map(offset => Number(offset) - start).filter(offset => offset >= 0 && offset <= descriptor.parts.length) } : {}),
      ...(message.role === "assistant" ? { nextclaw_partial_projection: true, [CONTEXT_COMPACTION_PART_START]: base + start } : {}),
      nextclaw_source: { messageId: message.id, partCount: base + message.parts.length,
        partIndices: descriptor.parts.map((_, index) => base + start + index) } } };
  };

  private archiveWindow = async (): Promise<void> => {
    const state = this.stateManager.getSnapshot();
    const messages = this.getSnapshot().messages;
    const checkpoint = messages.filter(message => message.metadata?.nextclaw_timeline_kind === "context_compaction").at(-1);
    const tail = messages.filter(message => message.metadata?.nextclaw_timeline_kind !== "context_compaction").slice(-254).map(this.archiveMessageView);
    if (checkpoint) tail.push(checkpoint);
    this.stateManager.hydrate({ sessionId: this.sessionId, messages: tail, activeRun: state.activeRun ?? undefined, contextWindow: state.contextWindow ?? undefined });
    // Keep the active message addressable for the next streaming delta without copying source bodies.
    const active = state.streamingMessage && tail.find(message => message.id === state.streamingMessage!.id);
    if (active) await this.stateManager.dispatch({ type: NcpEventType.MessageSent, payload: { sessionId: this.sessionId, message: active } });
    this.windowGrowthBytes = 0;
    for (const fragment of sessionJsonFragments(tail)) this.windowGrowthBytes += Buffer.byteLength(fragment);
  };

  private retainCompactedView = async (marker: NcpMessage): Promise<void> => {
    const state = this.stateManager.getSnapshot();
    const current = this.getSnapshot().messages;
    const byId = new Map(current.map(message => [message.id, message]));
    const view = buildContextCompactionModelProjection({ sessionId: this.sessionId, sessionMessages: current }).messages
      .filter(message => byId.has(message.id)).map(message => {
        const original = byId.get(message.id)!;
        const base = Number(original.metadata?.[CONTEXT_COMPACTION_PART_START] ?? 0);
        const start = Number(message.metadata?.[CONTEXT_COMPACTION_PART_START] ?? base);
        if (message.role !== "assistant" || (start === base && message.parts.length === original.parts.length && !original.metadata?.nextclaw_partial_projection)) return message;
        const physicalEnd = base + original.parts.length;
        return { ...message, metadata: { ...message.metadata, nextclaw_partial_projection: true,
          nextclaw_source: { messageId: message.id, partCount: physicalEnd,
            partIndices: message.parts.map((_, index) => start + index) } } };
      });
    const streaming = state.streamingMessage;
    if (streaming && !view.some(message => message.id === streaming.id)) {
      const end = Number(streaming.metadata?.[CONTEXT_COMPACTION_PART_START] ?? 0) + streaming.parts.length;
      view.push({ ...streaming, parts: [], metadata: { ...streaming.metadata, nextclaw_partial_projection: true,
        [CONTEXT_COMPACTION_PART_START]: end, nextclaw_source: { messageId: streaming.id, partCount: end, partIndices: [] } } });
    }
    view.push(marker);
    this.stateManager.hydrate({ sessionId: this.sessionId, messages: view, activeRun: state.activeRun ?? undefined, contextWindow: state.contextWindow ?? undefined });
    const active = streaming ? view.find(message => message.id === streaming.id) : undefined;
    if (active) await this.stateManager.dispatch({ type: NcpEventType.MessageSent, payload: { sessionId: this.sessionId, message: active } });
    this.windowGrowthBytes = 0;
    for (const fragment of sessionJsonFragments(view)) this.windowGrowthBytes += Buffer.byteLength(fragment);
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
      id: `queued-input-${crypto.randomUUID()}`,
      runId: `agent-run-${crypto.randomUUID()}`,
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
  private disposed = false;
  private readonly runs = new Map<string, SessionRun>();
  private readonly pendingCreations = new Map<string, Promise<SessionRun>>();
  private coldLoads = 0;
  private readonly coldWaiters: Array<() => void> = [];
  private readonly inactiveBytes = new Map<string, number>();

  constructor(
    private readonly sessionManager: Pick<AgentRunSessionHost, "listSessionMessages"> & Partial<Pick<SessionManager, "loadSessionRunSeed" | "publishSessionEvent" | "persistSessionEvent" | "captureCompactionSource">>,
    private readonly productActivitySink?: ProductActivitySink,
  ) {}

  getSessionRun = (sessionId: string): SessionRun | null => {
    const run = this.runs.get(sessionId);
    if (run) { this.runs.delete(sessionId); this.runs.set(sessionId, run); }
    return run ?? null;
  };

  isSessionRunning = (sessionId: string): boolean => this.runs.get(sessionId.trim())?.isBusy() ?? false;

  listActiveRuns = (): ReadonlyArray<{ sessionId: string; runId: string }> =>
    [...this.runs.values()].flatMap((run) => {
      const runId = run.getActiveRunId();
      return runId ? [{ sessionId: run.sessionId, runId }] : [];
    });

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
    if (this.coldLoads >= 2) {
      if (this.coldWaiters.length >= 128) throw Object.assign(new Error("Session loading capacity is full; retry shortly."), { code: "SESSION_CAPACITY_EXCEEDED" });
      await new Promise<void>(resolve => this.coldWaiters.push(resolve));
    } else this.coldLoads += 1;
    try { return await this.createSessionRunNow(sessionId); }
    finally {
      const next = this.coldWaiters.shift();
      if (next) next(); else this.coldLoads -= 1;
    }
  };

  private createSessionRunNow = async (sessionId: string): Promise<SessionRun> => {
    if (this.disposed) throw new Error("Session run manager is disposed.");
    if (this.runs.has(sessionId)) {
      throw new Error(`Session run already exists: ${sessionId}`);
    }
    const messages = this.sessionManager.loadSessionRunSeed
      ? await this.sessionManager.loadSessionRunSeed(sessionId)
      : await this.sessionManager.listSessionMessages(sessionId);
    if (this.disposed) throw new Error("Session run manager is disposed.");
    const checkpoint = readLatestContextCompactionCheckpoint(messages);
    const firstOrdinal = messages.reduce((first, message) => {
      const ordinal = Number((message.metadata?.nextclaw_source as { ordinal?: number } | undefined)?.ordinal);
      return Number.isSafeInteger(ordinal) ? Math.min(first, ordinal) : first;
    }, Number.POSITIVE_INFINITY);
    const missingRetained = checkpoint && [...(checkpoint.retainedMessageIds ?? []), ...(checkpoint.preservedUserMessageIds ?? [])]
      .some(id => !messages.some(message => message.id === id));
    if ((!checkpoint && firstOrdinal > 1 && Number.isFinite(firstOrdinal)) || missingRetained
      || readContextRecoveryState(messages, checkpoint).unresolvedArchive) {
      const now = new Date().toISOString();
      const retained = messages.filter(message => message.metadata?.nextclaw_timeline_kind !== "context_compaction");
      const marker = buildContextCompactionTimelineNcpMessage({ sessionId, messageId: `context-compaction-message-${crypto.randomUUID()}`, checkpoint: {
        version: 2, id: `ctx-${crypto.randomUUID()}`, status: "compressed", phase: "pre-run",
        summary: COMPACTION_RECOVERY_NOTICE, coveredUntil: retained[0]?.timestamp ?? now,
        retainedMessageIds: retained.map(message => message.id),
        coveredMessageCount: Math.max(0, firstOrdinal - 1), coveredSessionMessageCount: Math.max(0, firstOrdinal - 1),
        originalEstimatedTokens: 0, projectedEstimatedTokens: 0, createdAt: now, updatedAt: now,
        recovery: { required: true, reason: "unresolved-archive", archiveThrough: retained.reduce((latest, message) => Date.parse(message.timestamp) > Date.parse(latest) ? message.timestamp : latest, now) },
      } });
      if (this.sessionManager.captureCompactionSource) {
        const checkpoint = marker.metadata!.checkpoint as ContextCompactionCheckpoint;
        checkpoint.source = await this.sessionManager.captureCompactionSource(sessionId, messages.map(message => message.id));
      } else throw new Error("Cannot verify the source of the bounded history recovery view.");
      if (!this.sessionManager.publishSessionEvent) throw new Error("Cannot durably install the bounded history recovery view.");
      await this.sessionManager.publishSessionEvent({ sessionId, event: { type: NcpEventType.MessageSent, payload: { sessionId, message: marker } }, source: "bounded-session-run-seed", persistFirst: true });
      messages.push(marker);
    }
    const seed = {
      messages,
      sessionId,
    };
    const run = new SessionRun(seed, undefined, this.productActivitySink, this.sessionManager.persistSessionEvent);
    this.runs.set(sessionId, run);
    run.onStatusChange(status => {
      if (status === "running") this.inactiveBytes.delete(sessionId);
      else this.trimInactive(sessionId);
    });
    this.trimInactive(sessionId);
    return run;
  };

  private trimInactive = (protectedId: string): void => {
    const current = this.runs.get(protectedId);
    if (current && !current.isBusy()) {
      let bytes = 0;
      for (const fragment of sessionJsonFragments(current.getSnapshot().messages)) bytes += Buffer.byteLength(fragment);
      this.inactiveBytes.set(protectedId, bytes);
    }
    let total = [...this.inactiveBytes.values()].reduce((sum, bytes) => sum + bytes, 0);
    for (const [id, run] of this.runs) {
      if (total <= 64 * 1024 * 1024) break;
      if (id === protectedId || run.isBusy()) continue;
      total -= this.inactiveBytes.get(id) ?? 0;
      this.deleteSessionRun(id);
    }
  };

  deleteSessionRun = (sessionId: string): boolean => {
    const run = this.runs.get(sessionId);
    if (!run) {
      return false;
    }
    run.dispose();
    this.inactiveBytes.delete(sessionId);
    return this.runs.delete(sessionId);
  };

  dispose = (): void => {
    this.disposed = true;
    for (const run of this.runs.values()) {
      run.dispose();
    }
    this.runs.clear();
    this.inactiveBytes.clear();
    this.pendingCreations.clear();
  };
}
