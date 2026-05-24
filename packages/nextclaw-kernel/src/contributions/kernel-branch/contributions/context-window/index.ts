import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelBranch } from "@kernel/contributions/kernel-branch/index.js";
import {
  ContextCompactionPreflightService,
  createContextWindowSignature,
  isContextWindowSnapshot,
  readContextWindowEventSessionId,
  shouldRefreshContextWindowDuringStream,
  shouldRefreshContextWindowImmediately,
} from "@kernel/features/context-compaction/index.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
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

export class ContextWindowContribution implements KernelContribution {
  private readonly contextWindowPreview: ContextCompactionPreflightService;
  private readonly lastPublishedSignatureBySession = new Map<string, string>();
  private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private stopped = true;
  private unsubscribeNcpEvent: Unsubscribe | null = null;

  constructor(
    private readonly kernel: NextclawKernel,
    private readonly branch: KernelBranch,
  ) {
    this.contextWindowPreview = new ContextCompactionPreflightService({
      configManager: kernel.configManager,
    });
  }

  start = (): void => {
    if (this.unsubscribeNcpEvent) {
      return;
    }
    this.stopped = false;
    this.unsubscribeNcpEvent = this.kernel.eventBus.on(eventKeys.ncpEvent, this.handleNcpEvent);
  };

  dispose = (): void => {
    this.unsubscribeNcpEvent?.();
    this.unsubscribeNcpEvent = null;
    this.stopped = true;
    for (const timer of this.pendingTimers.values()) {
      clearTimeout(timer);
    }
    this.pendingTimers.clear();
    this.lastPublishedSignatureBySession.clear();
  };

  private handleNcpEvent = (event: NcpEndpointEvent): void => {
    const sessionId = readContextWindowEventSessionId(event);
    if (!sessionId || !this.branch.sessionRunManager.getSessionRun(sessionId)) {
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
      console.error(`[kernel-branch-context-window] failed to refresh ${sessionId}: ${formatBackgroundError(error)}`);
    });
  };

  private publishContextWindow = async (sessionId: string): Promise<void> => {
    if (this.stopped) {
      return;
    }
    const sessionRun = this.branch.sessionRunManager.getSessionRun(sessionId);
    if (!sessionRun) {
      return;
    }
    const session = await this.branch.sessionRepository.getSession(sessionId);
    const contextWindow = this.contextWindowPreview.preview({
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
      type: NcpEventType.ContextWindowUpdated,
      payload: {
        contextWindow,
        sessionId,
      },
    }, {
      emittedAt: new Date().toISOString(),
      source: "kernel-branch-context-window",
    });
  };

  private rememberPublishedContextWindow = (
    sessionId: string,
    contextWindow: Record<string, unknown>,
  ): void => {
    this.lastPublishedSignatureBySession.set(sessionId, createContextWindowSignature(contextWindow));
  };
}
