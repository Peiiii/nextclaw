import {
  NcpEventType,
  type NcpAgentConversationSnapshot,
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";

export type SessionRunSnapshot = {
  messages: readonly NcpMessage[];
  activeRunId: string | null;
};

export type SessionRunSeed = {
  sessionId: string;
  messages: readonly NcpMessage[];
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
    await this.stateManager.dispatchBatch(events);
  };

  startRun = (runId: string): void => {
    if (this.activeRunId) {
      throw new Error(`Session ${this.sessionId} already has an active run.`);
    }
    this.activeRunId = runId;
    this.notify();
  };

  finishRun = (runId: string): void => {
    if (this.activeRunId !== runId) {
      return;
    }
    this.activeRunId = null;
    this.notify();
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
    this.listeners.clear();
    this.unsubscribeStateManager();
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

  getSessionRun = (sessionId: string): SessionRun | null =>
    this.runs.get(sessionId) ?? null;

  createSessionRun = (seed: SessionRunSeed): SessionRun => {
    if (this.runs.has(seed.sessionId)) {
      throw new Error(`Session run already exists: ${seed.sessionId}`);
    }
    const run = new SessionRun(seed);
    this.runs.set(seed.sessionId, run);
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
