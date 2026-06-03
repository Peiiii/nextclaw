import { randomUUID } from "node:crypto";
import {
  NcpEventType,
  type NcpAgentConversationStateManager,
  type NcpEndpointEvent,
  type NcpMessage,
} from "@nextclaw/ncp";
import { DefaultNcpAgentConversationStateManager } from "@nextclaw/ncp-toolkit";
import type { SessionManager } from "@kernel/managers/session.manager.js";

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

  beginRun = (): { runId: string; signal: AbortSignal } => {
    if (this.activeRunId) {
      throw new Error(`Session ${this.sessionId} already has an active run.`);
    }
    const wasRunning = this.isRunning();
    const runId = `agent-run-${randomUUID()}`;
    const controller = new AbortController();
    this.activeRunId = runId;
    this.activeRunController = controller;
    this.emitStatusChangeIfNeeded(wasRunning);
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
    const wasRunning = this.isRunning();
    this.activeRunController.abort();
    this.activeRunController = null;
    this.activeRunId = null;
    this.emitStatusChangeIfNeeded(wasRunning);
    return true;
  };

  isRunning = (): boolean => this.activeRunId !== null;

  dispose = (): void => {
    const wasRunning = this.isRunning();
    this.activeRunController?.abort();
    this.activeRunController = null;
    this.activeRunId = null;
    this.emitStatusChangeIfNeeded(wasRunning);
    this.statusListeners.clear();
  };

  private applyRunEvents = (events: readonly NcpEndpointEvent[]): void => {
    const wasRunning = this.isRunning();
    for (const event of events) {
      if (event.type === NcpEventType.RunStarted && event.payload.runId) {
        this.activeRunId = event.payload.runId;
      }
      if (
        (event.type === NcpEventType.RunFinished || event.type === NcpEventType.RunError) &&
        (!event.payload.runId || event.payload.runId === this.activeRunId)
      ) {
        this.activeRunId = null;
        this.activeRunController = null;
      }
    }
    this.emitStatusChangeIfNeeded(wasRunning);
  };

  private emitStatusChangeIfNeeded = (
    wasRunning: boolean,
  ): void => {
    const running = this.isRunning();
    if (running === wasRunning) {
      return;
    }
    for (const listener of [...this.statusListeners]) {
      listener(running ? "running" : "idle");
    }
  };
}

export class SessionRunManager {
  private readonly runs = new Map<string, SessionRun>();

  constructor(private readonly sessionManager: SessionManager) {}

  getSessionRun = (sessionId: string): SessionRun | null =>
    this.runs.get(sessionId) ?? null;

  isSessionRunning = (sessionId: string): boolean => this.runs.get(sessionId.trim())?.isRunning() ?? false;

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
  };
}
