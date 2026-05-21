import type { NextclawKernel } from "@kernel/app/nextclaw-kernel.js";
import type { KernelContribution } from "@kernel/types/kernel-contribution.types.js";
import { type NcpEndpointEvent, NcpEventType } from "@nextclaw/ncp";
import { eventKeys, type Unsubscribe } from "@nextclaw/shared";

const STREAM_REFRESH_DELAY_MS = 1500;

function formatBackgroundError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack ?? error.message;
  }
  return String(error);
}

function readEventSessionId(event: NcpEndpointEvent): string | null {
  const payload = "payload" in event ? event.payload : null;
  if (!payload || typeof payload !== "object") {
    return null;
  }
  return "sessionId" in payload && typeof payload.sessionId === "string"
    ? payload.sessionId.trim() || null
    : null;
}

function isContextWindow(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createSignature(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

function shouldRefreshDuringStream(event: NcpEndpointEvent): boolean {
  switch (event.type) {
    case NcpEventType.MessageTextDelta:
    case NcpEventType.MessageReasoningDelta:
    case NcpEventType.MessageToolCallArgsDelta:
    case NcpEventType.MessageToolCallResult:
      return true;
    default:
      return false;
  }
}

function shouldRefreshImmediately(event: NcpEndpointEvent): boolean {
  switch (event.type) {
    case NcpEventType.MessageCompleted:
    case NcpEventType.MessageFailed:
    case NcpEventType.MessageAbort:
    case NcpEventType.RunFinished:
    case NcpEventType.RunError:
      return true;
    default:
      return false;
  }
}

export class SessionContextWindowContribution implements KernelContribution {
  private unsubscribeNcpEvent: Unsubscribe | null = null;
  private stopped = true;
  private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly lastPublishedSignatureBySession = new Map<string, string>();

  constructor(private readonly kernel: NextclawKernel) {}

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
    const sessionId = readEventSessionId(event);
    if (!sessionId) {
      return;
    }
    if (event.type === NcpEventType.ContextWindowUpdated) {
      this.rememberPublishedContextWindow(sessionId, event.payload.contextWindow);
      return;
    }
    if (shouldRefreshImmediately(event)) {
      this.refreshNow(sessionId);
      return;
    }
    if (shouldRefreshDuringStream(event)) {
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
      console.error(`[session-context-window] failed to refresh ${sessionId}: ${formatBackgroundError(error)}`);
    });
  };

  private publishContextWindow = async (sessionId: string): Promise<void> => {
    if (this.stopped) {
      return;
    }
    const summary = await this.kernel.ncpSessionApi.getSession(sessionId);
    const contextWindow = summary?.contextWindow;
    if (!isContextWindow(contextWindow) || this.stopped) {
      return;
    }
    const signature = createSignature(contextWindow);
    if (this.lastPublishedSignatureBySession.get(sessionId) === signature) {
      return;
    }
    this.lastPublishedSignatureBySession.set(sessionId, signature);
    await this.kernel.sessionRunManager.appendSessionEvent(sessionId, {
      type: NcpEventType.ContextWindowUpdated,
      payload: {
        sessionId,
        contextWindow,
      },
    });
  };

  private rememberPublishedContextWindow = (
    sessionId: string,
    contextWindow: Record<string, unknown>,
  ): void => {
    this.lastPublishedSignatureBySession.set(sessionId, createSignature(contextWindow));
  };
}
