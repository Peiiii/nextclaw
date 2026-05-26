import { randomUUID } from "node:crypto";
import {
  NcpEventType,
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import {
  eventKeys,
  type EventBus,
} from "@nextclaw/shared";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import type { SessionRepository } from "@kernel/features/agent-run/repositories/session.repository.js";

export type SessionRunSnapshot = {
  messages: readonly NcpMessage[];
};

export type SessionRunSeed = {
  sessionId: string;
  messages: readonly NcpMessage[];
};

export type SessionRunEventPublishMeta = {
  emittedAt?: string;
  source: string;
};

export type SessionRunActiveRun = {
  runId: string;
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

  isEmpty = (): boolean => this.messages.length === 0;
}

function isConversationStateEvent(event: NcpEndpointEvent): boolean {
  return event.type !== NcpEventType.ContextWindowUpdated;
}

export class SessionRun {
  readonly inbox = new MessageInbox<NcpMessage>();
  readonly sessionId: string;
  private activeRunId: string | null = null;
  private activeRunController: AbortController | null = null;

  constructor(
    seed: SessionRunSeed,
    private readonly eventBus?: EventBus,
    private readonly stateManager: NcpAgentConversationStateManager = new DefaultNcpAgentConversationStateManager(),
  ) {
    this.sessionId = seed.sessionId;
    this.stateManager.hydrate({
      sessionId: seed.sessionId,
      messages: seed.messages,
    });
  }

  getSnapshot = (): SessionRunSnapshot => {
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

  applyAndPublishEvents = async (
    events: readonly NcpEndpointEvent[],
    meta: SessionRunEventPublishMeta,
  ): Promise<void> => {
    await this.applyEvents(events);
    for (const event of events) {
      this.eventBus?.emit(eventKeys.ncpEvent, event, {
        emittedAt: meta.emittedAt ?? new Date().toISOString(),
        source: meta.source,
      });
    }
  };

  beginRun = (): SessionRunActiveRun => {
    if (this.activeRunId) {
      throw new Error(`Session ${this.sessionId} already has an active run.`);
    }
    const runId = `agent-run-${randomUUID()}`;
    const controller = new AbortController();
    this.activeRunId = runId;
    this.activeRunController = controller;
    return {
      runId,
      signal: controller.signal,
    };
  };

  abortRun = (runId?: string): boolean => {
    if (!this.activeRunId || !this.activeRunController) {
      return false;
    }
    if (runId && this.activeRunId !== runId) {
      return false;
    }
    this.activeRunController.abort();
    return true;
  };

  isRunning = (): boolean => this.activeRunId !== null;

  dispose = (): void => {
    this.activeRunController?.abort();
    this.activeRunController = null;
    this.activeRunId = null;
  };

  private applyRunEvents = (events: readonly NcpEndpointEvent[]): void => {
    for (const event of events) {
      if (event.type === NcpEventType.RunStarted && event.payload.runId) {
        this.activeRunId = event.payload.runId;
      }
      if (
        event.type === NcpEventType.MessageAbort ||
        ((event.type === NcpEventType.RunFinished || event.type === NcpEventType.RunError) &&
          (!event.payload.runId || event.payload.runId === this.activeRunId))
      ) {
        this.activeRunId = null;
        this.activeRunController = null;
      }
    }
  };
}

export class SessionRunManager {
  private readonly runs = new Map<string, SessionRun>();

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly eventBus?: EventBus,
  ) {}

  getSessionRun = (sessionId: string): SessionRun | null =>
    this.runs.get(sessionId) ?? null;

  isSessionRunning = (sessionId: string): boolean => this.runs.get(sessionId.trim())?.isRunning() ?? false;

  createSessionRun = async (sessionId: string): Promise<SessionRun> => {
    if (this.runs.has(sessionId)) {
      throw new Error(`Session run already exists: ${sessionId}`);
    }
    const messages = await this.sessionRepository.listSessionMessages(sessionId);
    const seed = {
      messages,
      sessionId,
    };
    const run = new SessionRun(seed, this.eventBus);
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
  };
}
