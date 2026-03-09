import type { SessionEventView } from '@/api/types';
import type {
  ExecuteStreamRunParams,
  StreamProgress,
  StreamReadyEvent,
  StreamSessionEvent,
  StreamSetters
} from './types';

function formatSendError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message) {
      return message;
    }
  }
  const raw = String(error ?? '').trim();
  return raw || 'Failed to send message';
}

export function clearStreamingState(setters: StreamSetters) {
  setters.setIsSending(false);
  setters.setOptimisticUserEvent(null);
  setters.setStreamingSessionEvents([]);
  setters.setStreamingAssistantText('');
  setters.setStreamingAssistantTimestamp(null);
  setters.setActiveBackendRunId(null);
  setters.setIsAwaitingAssistantOutput(false);
  setters.setCanStopCurrentRun(false);
  setters.setStopDisabledReason(null);
  setters.setLastSendError(null);
}

export function normalizeRequestedSkills(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const deduped = new Set<string>();
  for (const item of value) {
    const trimmed = item.trim();
    if (trimmed) {
      deduped.add(trimmed);
    }
  }
  return [...deduped];
}

function isAbortLikeError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return true;
    }
    const lower = error.message.toLowerCase();
    if (lower.includes('aborted') || lower.includes('abort')) {
      return true;
    }
  }
  return false;
}

function buildLocalAssistantEvent(content: string, eventType = 'message.assistant.local'): SessionEventView {
  const timestamp = new Date().toISOString();
  return {
    seq: Date.now(),
    type: eventType,
    timestamp,
    message: {
      role: 'assistant',
      content,
      timestamp
    }
  };
}

export function buildOptimisticUserEvent(seq: number, message: string): SessionEventView {
  const timestamp = new Date().toISOString();
  return {
    seq,
    type: 'message.user.optimistic',
    timestamp,
    message: {
      role: 'user',
      content: message,
      timestamp
    }
  };
}

async function refetchIfSessionVisible(params: ExecuteStreamRunParams & { resultSessionKey?: string }): Promise<void> {
  await params.refetchSessions();
  const activeSessionKey = params.selectedSessionKeyRef.current;
  if (
    !activeSessionKey ||
    activeSessionKey === params.sourceSessionKey ||
    (params.resultSessionKey && activeSessionKey === params.resultSessionKey)
  ) {
    await params.refetchHistory();
  }
}

function upsertStreamingEvent(params: ExecuteStreamRunParams, event: SessionEventView) {
  params.setters.setStreamingSessionEvents((prev) => {
    const next = [...prev];
    const hit = next.findIndex((streamEvent) => streamEvent.seq === event.seq);
    if (hit >= 0) {
      next[hit] = event;
    } else {
      next.push(event);
    }
    return next;
  });
}

function activateRun(params: ExecuteStreamRunParams, requestAbortController: AbortController) {
  params.activeRunRef.current = {
    localRunId: params.runId,
    sessionKey: params.sourceSessionKey,
    ...(params.sourceAgentId ? { agentId: params.sourceAgentId } : {}),
    requestAbortController,
    backendStopSupported: Boolean(params.sourceStopSupported),
    ...(params.sourceStopReason ? { backendStopReason: params.sourceStopReason } : {})
  };
}

function applyRunStartState(params: ExecuteStreamRunParams) {
  const { setters, optimisticUserEvent, sourceStopSupported, sourceStopReason } = params;
  setters.setStreamingSessionEvents([]);
  setters.setStreamingAssistantText('');
  setters.setStreamingAssistantTimestamp(null);
  setters.setActiveBackendRunId(null);
  setters.setOptimisticUserEvent(optimisticUserEvent);
  setters.setIsSending(true);
  setters.setIsAwaitingAssistantOutput(true);
  setters.setCanStopCurrentRun(false);
  setters.setStopDisabledReason(sourceStopSupported ? '__preparing__' : sourceStopReason ?? null);
  setters.setLastSendError(null);
}

function updateRunReadyState(params: ExecuteStreamRunParams, event: StreamReadyEvent) {
  const activeRun = params.activeRunRef.current;
  if (!activeRun || activeRun.localRunId !== params.runId) {
    return;
  }

  activeRun.backendRunId = event.runId?.trim() || undefined;
  params.setters.setActiveBackendRunId(activeRun.backendRunId ?? null);

  if (typeof event.stopSupported === 'boolean') {
    activeRun.backendStopSupported = event.stopSupported;
  }
  if (typeof event.stopReason === 'string' && event.stopReason.trim()) {
    activeRun.backendStopReason = event.stopReason.trim();
  }

  const canStopNow = Boolean(activeRun.backendStopSupported && activeRun.backendRunId);
  params.setters.setCanStopCurrentRun(canStopNow);
  params.setters.setStopDisabledReason(
    canStopNow
      ? null
      : activeRun.backendStopReason ?? (activeRun.backendStopSupported ? '__preparing__' : null)
  );
}

export class StreamRunController {
  private readonly requestAbortController = new AbortController();

  private readonly progress: StreamProgress = {
    streamText: '',
    hasAssistantSessionEvent: false,
    hasUserSessionEvent: false
  };

  constructor(private readonly params: ExecuteStreamRunParams) {}

  execute = async (): Promise<void> => {
    activateRun(this.params, this.requestAbortController);
    applyRunStartState(this.params);
    this.params.setters.setStreamingAssistantTimestamp(new Date().toISOString());

    try {
      const result = await this.params.openStream({
        signal: this.requestAbortController.signal,
        ...this.buildHandlers()
      });
      await this.finalizeSuccess(result);
    } catch (error) {
      await this.handleError(error);
    }
  };

  private readonly buildHandlers = () => {
    const onReady = (event: StreamReadyEvent) => {
      if (this.params.runId !== this.params.runIdRef.current) {
        return;
      }
      updateRunReadyState(this.params, event);
      if (event.sessionKey) {
        this.params.setSelectedSessionKey((prev) => (prev === event.sessionKey ? prev : event.sessionKey));
      }
    };

    const onDelta = (event: { delta: string }) => {
      if (this.params.runId !== this.params.runIdRef.current) {
        return;
      }
      this.progress.streamText += event.delta;
      this.params.setters.setStreamingAssistantText(this.progress.streamText);
      this.params.setters.setIsAwaitingAssistantOutput(false);
    };

    const onSessionEvent = (event: StreamSessionEvent) => {
      if (this.params.runId !== this.params.runIdRef.current) {
        return;
      }
      if (event.data.message?.role === 'user') {
        this.progress.hasUserSessionEvent = true;
        this.params.setters.setOptimisticUserEvent(null);
      }

      upsertStreamingEvent(this.params, event.data);

      if (event.data.message?.role === 'assistant') {
        this.progress.hasAssistantSessionEvent = true;
        this.progress.streamText = '';
        this.params.setters.setStreamingAssistantText('');
        this.params.setters.setIsAwaitingAssistantOutput(false);
      }
    };

    return { onReady, onDelta, onSessionEvent };
  };

  private readonly buildLocalEventsAfterSuccess = (params: {
    optimisticUserEvent: SessionEventView | null;
    hasUserSessionEvent: boolean;
    hasAssistantSessionEvent: boolean;
    streamText: string;
    finalReply: string;
  }): SessionEventView[] => {
    const localEvents: SessionEventView[] = [];
    const shouldKeepLocalUserEvent = !params.hasUserSessionEvent && params.optimisticUserEvent?.message?.role === 'user';

    if (shouldKeepLocalUserEvent && params.optimisticUserEvent) {
      localEvents.push(params.optimisticUserEvent);
    }

    const localAssistantText = !params.hasAssistantSessionEvent ? (params.streamText.trim() || params.finalReply) : '';
    if (localAssistantText) {
      localEvents.push(buildLocalAssistantEvent(localAssistantText));
    }

    return localEvents;
  };

  private readonly finalizeSuccess = async (result: { sessionKey: string; reply: string }) => {
    if (this.params.runId !== this.params.runIdRef.current) {
      return;
    }

    this.params.setters.setOptimisticUserEvent(null);
    if (result.sessionKey !== this.params.sourceSessionKey) {
      this.params.setSelectedSessionKey(result.sessionKey);
    }

    const localEvents = this.buildLocalEventsAfterSuccess({
      optimisticUserEvent: this.params.optimisticUserEvent,
      hasUserSessionEvent: this.progress.hasUserSessionEvent,
      hasAssistantSessionEvent: this.progress.hasAssistantSessionEvent,
      streamText: this.progress.streamText,
      finalReply: typeof result.reply === 'string' ? result.reply.trim() : ''
    });

    const hasServerSessionEvents = this.progress.hasUserSessionEvent || this.progress.hasAssistantSessionEvent;
    if (localEvents.length > 0 || !hasServerSessionEvents) {
      this.params.setters.setStreamingSessionEvents(localEvents);
    }
    this.params.setters.setStreamingAssistantText('');
    this.params.setters.setStreamingAssistantTimestamp(null);
    this.params.setters.setIsAwaitingAssistantOutput(false);
    this.params.setters.setIsSending(false);
    this.params.setters.setCanStopCurrentRun(false);
    this.params.setters.setStopDisabledReason(null);
    this.params.setters.setActiveBackendRunId(null);
    this.params.setters.setLastSendError(null);
    this.params.activeRunRef.current = null;

    void refetchIfSessionVisible({
      ...this.params,
      resultSessionKey: result.sessionKey
    });
  };

  private readonly handleError = async (error: unknown) => {
    if (this.params.runId !== this.params.runIdRef.current) {
      return;
    }

    const wasAborted = this.requestAbortController.signal.aborted || isAbortLikeError(error);
    this.params.runIdRef.current += 1;

    if (wasAborted) {
      clearStreamingState(this.params.setters);
      this.params.activeRunRef.current = null;
      await refetchIfSessionVisible(this.params);
      return;
    }

    clearStreamingState(this.params.setters);
    const sendError = formatSendError(error);
    this.params.setters.setLastSendError(sendError);
    this.params.setters.setStreamingSessionEvents([buildLocalAssistantEvent(sendError, 'message.assistant.error.local')]);
    this.params.setters.setActiveBackendRunId(null);
    this.params.activeRunRef.current = null;

    if (this.params.restoreDraftOnError) {
      this.params.setDraft((prev) => (prev.trim().length === 0 && this.params.sourceMessage ? this.params.sourceMessage : prev));
    }
  };
}

export async function executeStreamRun(params: ExecuteStreamRunParams): Promise<void> {
  const controller = new StreamRunController(params);
  await controller.execute();
}
