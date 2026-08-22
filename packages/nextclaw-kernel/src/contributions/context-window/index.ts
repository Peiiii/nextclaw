import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import {
  createContextWindowSignature,
  isContextWindowSnapshot,
  readContextWindowEventSessionId,
  shouldRefreshContextWindowDuringStream,
  shouldRefreshContextWindowImmediately,
} from "@kernel/features/context-compaction/index.js";
import { Contribution } from "@nextclaw/shared";
import {
  type NcpEndpointEvent,
  NcpEventType,
} from "@nextclaw/ncp";
import {
  eventKeys,
  type Unsubscribe,
} from "@nextclaw/shared";

const STREAM_REFRESH_DELAY_MS = 1500;

function formatBackgroundError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

export class ContextWindowContribution extends Contribution {
  private readonly lastPublishedSignatureBySession = new Map<string, string>();
  private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private stopped = true;

  constructor(private readonly kernel: NextclawKernel) {
    super();
  }

  protected setup = (): void => {
    this.effect(() => {
      this.stopped = false;
      const unsubscribe: Unsubscribe = this.kernel.eventBus.on(
        eventKeys.ncpEvent,
        this.handleNcpEvent,
      );
      return () => {
        unsubscribe();
        this.stopped = true;
        for (const timer of this.pendingTimers.values()) {
          clearTimeout(timer);
        }
        this.pendingTimers.clear();
        this.lastPublishedSignatureBySession.clear();
      };
    });
  };

  private handleNcpEvent = (event: NcpEndpointEvent): void => {
    const sessionId = readContextWindowEventSessionId(event);
    if (!sessionId || !this.kernel.sessionRunManager.getSessionRun(sessionId)) {
      return;
    }
    if (event.type === NcpEventType.ContextWindowUpdated) {
      this.rememberPublishedContextWindow(sessionId, event.payload.contextWindow);
      return;
    }
    if (shouldRefreshContextWindowImmediately(event)) {
      this.refreshNow(sessionId);
      return;
    }
    if (shouldRefreshContextWindowDuringStream(event)) {
      this.refreshSoon(sessionId);
    }
  };

  private refreshSoon = (sessionId: string): void => {
    if (this.pendingTimers.has(sessionId)) {
      return;
    }
    const timer = setTimeout(() => {
      this.pendingTimers.delete(sessionId);
      this.refreshNow(sessionId);
    }, STREAM_REFRESH_DELAY_MS);
    this.pendingTimers.set(sessionId, timer);
  };

  private refreshNow = (sessionId: string): void => {
    const timer = this.pendingTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.pendingTimers.delete(sessionId);
    }
    void this.publishContextWindow(sessionId).catch((error: unknown) => {
      console.error(`[context-window] failed to refresh ${sessionId}: ${formatBackgroundError(error)}`);
    });
  };

  private publishContextWindow = async (sessionId: string): Promise<void> => {
    if (this.stopped) {
      return;
    }
    const sessionRun = this.kernel.sessionRunManager.getSessionRun(sessionId);
    if (!sessionRun) {
      return;
    }
    const session = await this.kernel.sessionManager.getAgentRunSession(sessionId);
    const contextWindow = await this.kernel.agentContextWindowManager.previewSession({
      requestMetadata: session.metadata,
      sessionId,
      sessionMessages: sessionRun.getSnapshot().messages,
      storedAgentId: session.agentId,
      storedMetadata: session.metadata,
    });
    if (!isContextWindowSnapshot(contextWindow) || this.stopped) {
      return;
    }
    const signature = createContextWindowSignature(contextWindow);
    if (this.lastPublishedSignatureBySession.get(sessionId) === signature) {
      return;
    }
    this.lastPublishedSignatureBySession.set(sessionId, signature);
    this.kernel.eventBus.emit(eventKeys.ncpEvent, {
      occurredAt: new Date().toISOString(),
      type: NcpEventType.ContextWindowUpdated,
      payload: {
        contextWindow,
        sessionId,
      },
    }, {
      emittedAt: new Date().toISOString(),
      source: "context-window",
    });
  };

  private rememberPublishedContextWindow = (
    sessionId: string,
    contextWindow: Record<string, unknown>,
  ): void => {
    this.lastPublishedSignatureBySession.set(sessionId, createContextWindowSignature(contextWindow));
  };
}
