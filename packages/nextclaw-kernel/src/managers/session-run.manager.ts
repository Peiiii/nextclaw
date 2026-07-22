import { randomUUID } from "node:crypto";
import {
  NcpEventType,
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import type { SessionManager } from "@kernel/managers/session.manager.js";
import type { AgentRunRequest } from "@kernel/types/agent-run.types.js";
import type { AgentRunSession } from "@kernel/types/session.types.js";

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

export class MessageInbox<T> {
  private readonly messages: T[] = [];

  enqueue = (message: T): void => {
    this.messages.push(message);
  };

  drain = (): T[] => {
    return this.messages.splice(0, this.messages.length);
  };
}

function isConversationStateEvent(event: NcpEndpointEvent): boolean {
  return event.type !== NcpEventType.ContextWindowUpdated;
}

export class SessionRun {
  readonly inbox = new MessageInbox<NcpMessage>();
  readonly sessionId: string;
  private readonly statusListeners = new Set<(status: "idle" | "running") => void>();
  private readonly queuedRequests: SessionRunQueuedRequest[] = [];
  private activeRunId: string | null = null;
  private activeRunController: AbortController | null = null;

  constructor(
    seed: {
      sessionId: string;
      messages: readonly NcpMessage[];
    },
    private readonly stateManager: NcpAgentConversationStateManager = new DefaultNcpAgentConversationStateManager(),
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
      messages: snapshot.streamingMessage ? [...snapshot.messages, snapshot.streamingMessage] : snapshot.messages,
    };
  };

  applyEvents = async (events: readonly NcpEndpointEvent[]): Promise<void> => {
    this.applyRunEvents(events);
    const conversationEvents = events.filter(isConversationStateEvent);
    if (conversationEvents.length > 0) {
      await this.stateManager.dispatchBatch(conversationEvents);
    }
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
    this.queuedRequests.push(queuedRequest);
    this.emitStatusChangeIfNeeded(wasBusy);
    return structuredClone(queuedRequest);
  };

  listQueuedRequests = (): readonly SessionRunQueuedRequest[] =>
    structuredClone(this.queuedRequests);

  removeQueuedRequest = (queuedRequestId: string): SessionRunQueuedRequest | null => {
    const index = this.queuedRequests.findIndex(({ id }) => id === queuedRequestId);
    if (index < 0) {
      return null;
    }
    const wasBusy = this.isBusy();
    const [removed] = this.queuedRequests.splice(index, 1);
    this.emitStatusChangeIfNeeded(wasBusy);
    return removed ? structuredClone(removed) : null;
  };

  beginNextRun = (): SessionRunActiveRequest | null => {
    if (this.activeRunId) {
      return null;
    }
    const wasBusy = this.isBusy();
    const queuedRequest = this.queuedRequests.shift();
    if (!queuedRequest) {
      return null;
    }
    const controller = new AbortController();
    this.activeRunId = queuedRequest.runId;
    this.activeRunController = controller;
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

  isBusy = (): boolean => this.isRunning() || this.queuedRequests.length > 0;

  dispose = (): void => {
    const wasBusy = this.isBusy();
    this.activeRunController?.abort({
      code: "abort-error",
      message: "Session run owner was disposed; the current run was cancelled.",
      details: { source: "session-run-manager" },
    });
    this.activeRunController = null;
    this.activeRunId = null;
    this.queuedRequests.length = 0;
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
        this.activeRunId = null;
        this.activeRunController = null;
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

  constructor(private readonly sessionManager: SessionManager) {}

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
    const run = new SessionRun(seed);
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
