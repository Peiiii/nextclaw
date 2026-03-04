import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { SessionEventView } from '@/api/types';
import { sendChatTurnStream, stopChatTurn } from '@/api/config';

type PendingChatMessage = {
  id: number;
  message: string;
  sessionKey: string;
  agentId: string;
  model?: string;
  requestedSkills?: string[];
  stopSupported?: boolean;
  stopReason?: string;
};

type ActiveRunState = {
  localRunId: number;
  sessionKey: string;
  agentId: string;
  requestAbortController: AbortController;
  backendRunId?: string;
  backendStopSupported: boolean;
  backendStopReason?: string;
};

type SendMessageParams = {
  message: string;
  sessionKey: string;
  agentId: string;
  model?: string;
  requestedSkills?: string[];
  stopSupported?: boolean;
  stopReason?: string;
  restoreDraftOnError?: boolean;
};

type UseChatStreamControllerParams = {
  nextOptimisticUserSeq: number;
  selectedSessionKeyRef: MutableRefObject<string | null>;
  setSelectedSessionKey: Dispatch<SetStateAction<string | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
  refetchSessions: () => Promise<unknown>;
  refetchHistory: () => Promise<unknown>;
};

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

type StreamSetters = {
  setOptimisticUserEvent: Dispatch<SetStateAction<SessionEventView | null>>;
  setStreamingSessionEvents: Dispatch<SetStateAction<SessionEventView[]>>;
  setStreamingAssistantText: Dispatch<SetStateAction<string>>;
  setStreamingAssistantTimestamp: Dispatch<SetStateAction<string | null>>;
  setIsSending: Dispatch<SetStateAction<boolean>>;
  setIsAwaitingAssistantOutput: Dispatch<SetStateAction<boolean>>;
  setCanStopCurrentRun: Dispatch<SetStateAction<boolean>>;
  setStopDisabledReason: Dispatch<SetStateAction<string | null>>;
  setLastSendError: Dispatch<SetStateAction<string | null>>;
};

function clearStreamingState(setters: StreamSetters) {
  setters.setIsSending(false);
  setters.setOptimisticUserEvent(null);
  setters.setStreamingSessionEvents([]);
  setters.setStreamingAssistantText('');
  setters.setStreamingAssistantTimestamp(null);
  setters.setIsAwaitingAssistantOutput(false);
  setters.setCanStopCurrentRun(false);
  setters.setStopDisabledReason(null);
  setters.setLastSendError(null);
}

function normalizeRequestedSkills(value: string[] | undefined): string[] {
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

async function refetchIfSessionVisible(params: {
  selectedSessionKeyRef: MutableRefObject<string | null>;
  currentSessionKey: string;
  resultSessionKey?: string;
  refetchSessions: () => Promise<unknown>;
  refetchHistory: () => Promise<unknown>;
}): Promise<void> {
  await params.refetchSessions();
  const activeSessionKey = params.selectedSessionKeyRef.current;
  if (
    !activeSessionKey ||
    activeSessionKey === params.currentSessionKey ||
    (params.resultSessionKey && activeSessionKey === params.resultSessionKey)
  ) {
    await params.refetchHistory();
  }
}

async function executeSendRun(params: {
  item: PendingChatMessage;
  runId: number;
  runIdRef: MutableRefObject<number>;
  activeRunRef: MutableRefObject<ActiveRunState | null>;
  nextOptimisticUserSeq: number;
  selectedSessionKeyRef: MutableRefObject<string | null>;
  setSelectedSessionKey: Dispatch<SetStateAction<string | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
  refetchSessions: () => Promise<unknown>;
  refetchHistory: () => Promise<unknown>;
  restoreDraftOnError?: boolean;
  setters: StreamSetters;
}): Promise<void> {
  const {
    item,
    runId,
    runIdRef,
    activeRunRef,
    nextOptimisticUserSeq,
    selectedSessionKeyRef,
    setSelectedSessionKey,
    setDraft,
    refetchSessions,
    refetchHistory,
    restoreDraftOnError,
    setters
  } = params;

  const requestAbortController = new AbortController();
  activeRunRef.current = {
    localRunId: runId,
    sessionKey: item.sessionKey,
    agentId: item.agentId,
    requestAbortController,
    backendStopSupported: Boolean(item.stopSupported),
    ...(item.stopReason ? { backendStopReason: item.stopReason } : {})
  };

  setters.setStreamingSessionEvents([]);
  setters.setStreamingAssistantText('');
  setters.setStreamingAssistantTimestamp(null);
  setters.setOptimisticUserEvent({
    seq: nextOptimisticUserSeq,
    type: 'message.user.optimistic',
    timestamp: new Date().toISOString(),
    message: {
      role: 'user',
      content: item.message,
      timestamp: new Date().toISOString()
    }
  });
  setters.setIsSending(true);
  setters.setIsAwaitingAssistantOutput(true);
  setters.setCanStopCurrentRun(false);
  setters.setStopDisabledReason(item.stopSupported ? '__preparing__' : item.stopReason ?? null);
  setters.setLastSendError(null);

  let streamText = '';
  try {
    let hasAssistantSessionEvent = false;
    const streamTimestamp = new Date().toISOString();
    setters.setStreamingAssistantTimestamp(streamTimestamp);

    const requestedSkills = normalizeRequestedSkills(item.requestedSkills);
    const result = await sendChatTurnStream(
      {
        message: item.message,
        sessionKey: item.sessionKey,
        agentId: item.agentId,
        ...(item.model ? { model: item.model } : {}),
        ...(requestedSkills.length > 0
          ? {
              metadata: {
                requested_skills: requestedSkills
              }
            }
          : {}),
        channel: 'ui',
        chatId: 'web-ui'
      },
      {
        signal: requestAbortController.signal,
        onReady: (event) => {
          if (runId !== runIdRef.current) {
            return;
          }
          const activeRun = activeRunRef.current;
          if (activeRun && activeRun.localRunId === runId) {
            activeRun.backendRunId = event.runId?.trim() || undefined;
            if (typeof event.stopSupported === 'boolean') {
              activeRun.backendStopSupported = event.stopSupported;
            }
            if (typeof event.stopReason === 'string' && event.stopReason.trim().length > 0) {
              activeRun.backendStopReason = event.stopReason.trim();
            }
            const canStopNow = Boolean(activeRun.backendStopSupported && activeRun.backendRunId);
            setters.setCanStopCurrentRun(canStopNow);
            setters.setStopDisabledReason(
              canStopNow
                ? null
                : activeRun.backendStopReason ?? (activeRun.backendStopSupported ? '__preparing__' : null)
            );
          }
          if (event.sessionKey) {
            setSelectedSessionKey((prev) => (prev === event.sessionKey ? prev : event.sessionKey));
          }
        },
        onDelta: (event) => {
          if (runId !== runIdRef.current) {
            return;
          }
          streamText += event.delta;
          setters.setStreamingAssistantText(streamText);
          setters.setIsAwaitingAssistantOutput(false);
        },
        onSessionEvent: (event) => {
          if (runId !== runIdRef.current) {
            return;
          }
          if (event.data.message?.role === 'user') {
            setters.setOptimisticUserEvent(null);
          }
          setters.setStreamingSessionEvents((prev) => {
            const next = [...prev];
            const hit = next.findIndex((streamEvent) => streamEvent.seq === event.data.seq);
            if (hit >= 0) {
              next[hit] = event.data;
            } else {
              next.push(event.data);
            }
            return next;
          });
          if (event.data.message?.role === 'assistant') {
            hasAssistantSessionEvent = true;
            streamText = '';
            setters.setStreamingAssistantText('');
            setters.setIsAwaitingAssistantOutput(false);
          }
        }
      }
    );
    if (runId !== runIdRef.current) {
      return;
    }
    setters.setOptimisticUserEvent(null);
    if (result.sessionKey !== item.sessionKey) {
      setSelectedSessionKey(result.sessionKey);
    }

    const localAssistantText = !hasAssistantSessionEvent ? streamText.trim() : '';
    await refetchIfSessionVisible({
      selectedSessionKeyRef,
      currentSessionKey: item.sessionKey,
      resultSessionKey: result.sessionKey,
      refetchSessions,
      refetchHistory
    });

    setters.setStreamingSessionEvents(localAssistantText ? [buildLocalAssistantEvent(localAssistantText)] : []);

    setters.setStreamingAssistantText('');
    setters.setStreamingAssistantTimestamp(null);
    setters.setIsAwaitingAssistantOutput(false);
    setters.setIsSending(false);
    setters.setCanStopCurrentRun(false);
    setters.setStopDisabledReason(null);
    setters.setLastSendError(null);
    activeRunRef.current = null;
  } catch (error) {
    if (runId !== runIdRef.current) {
      return;
    }
    const wasAborted = requestAbortController.signal.aborted || isAbortLikeError(error);
    runIdRef.current += 1;
    if (wasAborted) {
      const localAssistantText = streamText.trim();
      setters.setOptimisticUserEvent(null);
      setters.setStreamingAssistantText('');
      setters.setStreamingAssistantTimestamp(null);
      setters.setIsSending(false);
      setters.setIsAwaitingAssistantOutput(false);
      setters.setCanStopCurrentRun(false);
      setters.setStopDisabledReason(null);
      setters.setLastSendError(null);
      activeRunRef.current = null;
      await refetchIfSessionVisible({
        selectedSessionKeyRef,
        currentSessionKey: item.sessionKey,
        refetchSessions,
        refetchHistory
      });
      setters.setStreamingSessionEvents(localAssistantText ? [buildLocalAssistantEvent(localAssistantText)] : []);
      return;
    }

    clearStreamingState(setters);
    const sendError = formatSendError(error);
    setters.setLastSendError(sendError);
    setters.setStreamingSessionEvents([buildLocalAssistantEvent(sendError, 'message.assistant.error.local')]);
    activeRunRef.current = null;
    if (restoreDraftOnError) {
      setDraft((prev) => (prev.trim().length === 0 ? item.message : prev));
    }
  }
}

export function useChatStreamController(params: UseChatStreamControllerParams) {
  const [optimisticUserEvent, setOptimisticUserEvent] = useState<SessionEventView | null>(null);
  const [streamingSessionEvents, setStreamingSessionEvents] = useState<SessionEventView[]>([]);
  const [streamingAssistantText, setStreamingAssistantText] = useState('');
  const [streamingAssistantTimestamp, setStreamingAssistantTimestamp] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isAwaitingAssistantOutput, setIsAwaitingAssistantOutput] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<PendingChatMessage[]>([]);
  const [canStopCurrentRun, setCanStopCurrentRun] = useState(false);
  const [stopDisabledReason, setStopDisabledReason] = useState<string | null>(null);
  const [lastSendError, setLastSendError] = useState<string | null>(null);

  const streamRunIdRef = useRef(0);
  const queueIdRef = useRef(0);
  const activeRunRef = useRef<ActiveRunState | null>(null);

  const resetStreamState = useCallback(() => {
    streamRunIdRef.current += 1;
    setQueuedMessages([]);
    activeRunRef.current?.requestAbortController.abort();
    activeRunRef.current = null;
    clearStreamingState({
      setOptimisticUserEvent,
      setStreamingSessionEvents,
      setStreamingAssistantText,
      setStreamingAssistantTimestamp,
      setIsSending,
      setIsAwaitingAssistantOutput,
      setCanStopCurrentRun,
      setStopDisabledReason,
      setLastSendError
    });
  }, []);

  useEffect(() => {
    return () => {
      streamRunIdRef.current += 1;
      activeRunRef.current?.requestAbortController.abort();
      activeRunRef.current = null;
    };
  }, []);

  const runSend = useCallback(
    async (item: PendingChatMessage, options?: { restoreDraftOnError?: boolean }) => {
      setLastSendError(null);
      streamRunIdRef.current += 1;
      await executeSendRun({
        item,
        runId: streamRunIdRef.current,
        runIdRef: streamRunIdRef,
        activeRunRef,
        nextOptimisticUserSeq: params.nextOptimisticUserSeq,
        selectedSessionKeyRef: params.selectedSessionKeyRef,
        setSelectedSessionKey: params.setSelectedSessionKey,
        setDraft: params.setDraft,
        refetchSessions: params.refetchSessions,
        refetchHistory: params.refetchHistory,
        restoreDraftOnError: options?.restoreDraftOnError,
        setters: {
          setOptimisticUserEvent,
          setStreamingSessionEvents,
          setStreamingAssistantText,
          setStreamingAssistantTimestamp,
          setIsSending,
          setIsAwaitingAssistantOutput,
          setCanStopCurrentRun,
          setStopDisabledReason,
          setLastSendError
        }
      });
    },
    [params]
  );

  useEffect(() => {
    if (isSending || queuedMessages.length === 0) {
      return;
    }
    const [next, ...rest] = queuedMessages;
    setQueuedMessages(rest);
    void runSend(next, { restoreDraftOnError: true });
  }, [isSending, queuedMessages, runSend]);

  const sendMessage = useCallback(
    async (payload: SendMessageParams) => {
      setLastSendError(null);
      queueIdRef.current += 1;
      const item: PendingChatMessage = {
        id: queueIdRef.current,
        message: payload.message,
        sessionKey: payload.sessionKey,
        agentId: payload.agentId,
        ...(payload.model ? { model: payload.model } : {}),
        ...(payload.requestedSkills && payload.requestedSkills.length > 0
          ? { requestedSkills: payload.requestedSkills }
          : {}),
        ...(typeof payload.stopSupported === 'boolean' ? { stopSupported: payload.stopSupported } : {}),
        ...(payload.stopReason ? { stopReason: payload.stopReason } : {})
      };
      if (isSending) {
        setQueuedMessages((prev) => [...prev, item]);
        return;
      }
      await runSend(item, { restoreDraftOnError: payload.restoreDraftOnError });
    },
    [isSending, runSend]
  );

  const stopCurrentRun = useCallback(async () => {
    const activeRun = activeRunRef.current;
    if (!activeRun) {
      return;
    }
    if (!activeRun.backendStopSupported) {
      return;
    }

    setCanStopCurrentRun(false);
    setQueuedMessages([]);
    if (activeRun.backendRunId) {
      try {
        await stopChatTurn({
          runId: activeRun.backendRunId,
          sessionKey: activeRun.sessionKey,
          agentId: activeRun.agentId
        });
      } catch {
        // Keep local abort as fallback even if stop API fails.
      }
    }
    activeRun.requestAbortController.abort();
  }, []);

  return {
    optimisticUserEvent,
    streamingSessionEvents,
    streamingAssistantText,
    streamingAssistantTimestamp,
    isSending,
    isAwaitingAssistantOutput,
    queuedCount: queuedMessages.length,
    canStopCurrentRun,
    stopDisabledReason,
    lastSendError,
    sendMessage,
    stopCurrentRun,
    resetStreamState
  };
}
