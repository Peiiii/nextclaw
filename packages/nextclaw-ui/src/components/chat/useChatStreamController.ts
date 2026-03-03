import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { SessionEventView } from '@/api/types';
import { sendChatTurnStream } from '@/api/config';

type PendingChatMessage = {
  id: number;
  message: string;
  sessionKey: string;
  agentId: string;
  model?: string;
  requestedSkills?: string[];
};

type SendMessageParams = {
  message: string;
  sessionKey: string;
  agentId: string;
  model?: string;
  requestedSkills?: string[];
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

type StreamSetters = {
  setOptimisticUserEvent: Dispatch<SetStateAction<SessionEventView | null>>;
  setStreamingSessionEvents: Dispatch<SetStateAction<SessionEventView[]>>;
  setStreamingAssistantText: Dispatch<SetStateAction<string>>;
  setStreamingAssistantTimestamp: Dispatch<SetStateAction<string | null>>;
  setIsSending: Dispatch<SetStateAction<boolean>>;
  setIsAwaitingAssistantOutput: Dispatch<SetStateAction<boolean>>;
};

function clearStreamingState(setters: StreamSetters) {
  setters.setIsSending(false);
  setters.setOptimisticUserEvent(null);
  setters.setStreamingSessionEvents([]);
  setters.setStreamingAssistantText('');
  setters.setStreamingAssistantTimestamp(null);
  setters.setIsAwaitingAssistantOutput(false);
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

async function executeSendRun(params: {
  item: PendingChatMessage;
  runId: number;
  runIdRef: MutableRefObject<number>;
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
    nextOptimisticUserSeq,
    selectedSessionKeyRef,
    setSelectedSessionKey,
    setDraft,
    refetchSessions,
    refetchHistory,
    restoreDraftOnError,
    setters
  } = params;

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

  try {
    let streamText = '';
    const streamTimestamp = new Date().toISOString();
    setters.setStreamingAssistantTimestamp(streamTimestamp);

    const requestedSkills = normalizeRequestedSkills(item.requestedSkills);
    const result = await sendChatTurnStream({
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
    }, {
      onReady: (event) => {
        if (runId !== runIdRef.current) {
          return;
        }
        if (event.sessionKey) {
          setSelectedSessionKey((prev) => prev === event.sessionKey ? prev : event.sessionKey);
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
          // Reset delta accumulator once assistant event lands in session timeline.
          streamText = '';
          setters.setStreamingAssistantText('');
          setters.setIsAwaitingAssistantOutput(false);
        }
      }
    });
    if (runId !== runIdRef.current) {
      return;
    }
    setters.setOptimisticUserEvent(null);
    if (result.sessionKey !== item.sessionKey) {
      setSelectedSessionKey(result.sessionKey);
    }
    await refetchSessions();
    const activeSessionKey = selectedSessionKeyRef.current;
    if (!activeSessionKey || activeSessionKey === item.sessionKey || activeSessionKey === result.sessionKey) {
      await refetchHistory();
    }
    setters.setStreamingSessionEvents([]);
    setters.setStreamingAssistantText('');
    setters.setStreamingAssistantTimestamp(null);
    setters.setIsAwaitingAssistantOutput(false);
    setters.setIsSending(false);
  } catch {
    if (runId !== runIdRef.current) {
      return;
    }
    runIdRef.current += 1;
    clearStreamingState(setters);
    if (restoreDraftOnError) {
      setDraft((prev) => prev.trim().length === 0 ? item.message : prev);
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

  const streamRunIdRef = useRef(0);
  const queueIdRef = useRef(0);

  const resetStreamState = useCallback(() => {
    streamRunIdRef.current += 1;
    setQueuedMessages([]);
    clearStreamingState({
      setOptimisticUserEvent,
      setStreamingSessionEvents,
      setStreamingAssistantText,
      setStreamingAssistantTimestamp,
      setIsSending,
      setIsAwaitingAssistantOutput
    });
  }, []);

  useEffect(() => {
    return () => {
      streamRunIdRef.current += 1;
    };
  }, []);

  const runSend = useCallback(
    async (item: PendingChatMessage, options?: { restoreDraftOnError?: boolean }) => {
      streamRunIdRef.current += 1;
      await executeSendRun({
        item,
        runId: streamRunIdRef.current,
        runIdRef: streamRunIdRef,
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
          setIsAwaitingAssistantOutput
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
      queueIdRef.current += 1;
      const item: PendingChatMessage = {
        id: queueIdRef.current,
        message: payload.message,
        sessionKey: payload.sessionKey,
        agentId: payload.agentId,
        ...(payload.model ? { model: payload.model } : {}),
        ...(payload.requestedSkills && payload.requestedSkills.length > 0
          ? { requestedSkills: payload.requestedSkills }
          : {})
      };
      if (isSending) {
        setQueuedMessages((prev) => [...prev, item]);
        return;
      }
      await runSend(item, { restoreDraftOnError: payload.restoreDraftOnError });
    },
    [isSending, runSend]
  );

  return {
    optimisticUserEvent,
    streamingSessionEvents,
    streamingAssistantText,
    streamingAssistantTimestamp,
    isSending,
    isAwaitingAssistantOutput,
    queuedCount: queuedMessages.length,
    sendMessage,
    resetStreamState
  };
}
