import { randomUUID } from "node:crypto";
import {
  NcpEventType,
  type NcpAgentConversationSnapshot,
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import type { SessionRepository } from "@kernel/features/agent-run/repositories/session.repository.js";

export type SessionRunSnapshot = {
  messages: readonly NcpMessage[];
  activeRunId: string | null;
};

export type SessionRunSeed = {
  sessionId: string;
  messages: readonly NcpMessage[];
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

export class SessionRun {
  readonly inbox = new MessageInbox<NcpMessage>();
  readonly sessionId: string;
  private activeRunId: string | null = null;
  private activeRunController: AbortController | null = null;
  private readonly listeners = new Set<(snapshot: SessionRunSnapshot) => void>();
  private readonly unsubscribeStateManager: () => void;

  constructor(
    seed: SessionRunSeed,
    private readonly stateManager: NcpAgentConversationStateManager = new DefaultNcpAgentConversationStateManager(),
  ) {
    this.sessionId = seed.sessionId;
    this.stateManager.hydrate({
      sessionId: seed.sessionId,
      messages: seed.messages,
    });
    this.unsubscribeStateManager = this.stateManager.subscribe(this.notify);
  }

  getSnapshot = (): SessionRunSnapshot => this.toSnapshot(this.stateManager.getSnapshot());

  applyEvents = async (events: readonly NcpEndpointEvent[]): Promise<void> => {
    this.applyRunEvents(events);
    await this.stateManager.dispatchBatch(events);
  };

  beginRun = (): SessionRunActiveRun => {
    if (this.activeRunId) {
      throw new Error(`Session ${this.sessionId} already has an active run.`);
    }
    const runId = `agent-run-${randomUUID()}`;
    const controller = new AbortController();
    this.activeRunId = runId;
    this.activeRunController = controller;
    this.notify();
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

  drainInboxAsMessageSentEvents = (): NcpEndpointEvent[] =>
    this.inbox.drain().map((message) => ({
      type: NcpEventType.MessageSent,
      payload: {
        sessionId: this.sessionId,
        message,
      },
    }));

  subscribe = (listener: (snapshot: SessionRunSnapshot) => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  dispose = (): void => {
    this.activeRunController?.abort();
    this.activeRunController = null;
    this.activeRunId = null;
    this.listeners.clear();
    this.unsubscribeStateManager();
  };

  private applyRunEvents = (events: readonly NcpEndpointEvent[]): void => {
    let changed = false;
    for (const event of events) {
      if (event.type === NcpEventType.RunStarted && event.payload.runId) {
        this.activeRunId = event.payload.runId;
        changed = true;
      }
      if (event.type === NcpEventType.RunFinished || event.type === NcpEventType.RunError) {
        if (!event.payload.runId || event.payload.runId === this.activeRunId) {
          this.activeRunId = null;
          this.activeRunController = null;
          changed = true;
        }
      }
      if (event.type === NcpEventType.MessageAbort) {
        this.activeRunId = null;
        this.activeRunController = null;
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  };

  private toSnapshot = (snapshot: NcpAgentConversationSnapshot): SessionRunSnapshot => ({
    messages: snapshot.messages,
    activeRunId: this.activeRunId,
  });

  private notify = (): void => {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  };
}

export class SessionRunManager {
  private readonly runs = new Map<string, SessionRun>();

  constructor(private readonly sessionRepository: SessionRepository) {}

  getSessionRun = (sessionId: string): SessionRun | null =>
    this.runs.get(sessionId) ?? null;

  createSessionRun = async (sessionId: string): Promise<SessionRun> => {
    if (this.runs.has(sessionId)) {
      throw new Error(`Session run already exists: ${sessionId}`);
    }
    const messages = await this.sessionRepository.listSessionMessages(sessionId);
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
  };
}
