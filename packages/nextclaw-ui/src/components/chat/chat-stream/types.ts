import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { ChatRunView, SessionEventView } from '@/api/types';

export type PendingChatMessage = {
  id: number;
  message: string;
  sessionKey: string;
  agentId: string;
  sessionType?: string;
  model?: string;
  requestedSkills?: string[];
  stopSupported?: boolean;
  stopReason?: string;
};

export type QueuedChatMessageView = {
  id: number;
  message: string;
};

export type ActiveRunState = {
  localRunId: number;
  sessionKey: string;
  agentId?: string;
  requestAbortController: AbortController;
  backendRunId?: string;
  backendStopSupported: boolean;
  backendStopReason?: string;
};

export type SendMessageParams = {
  message: string;
  sessionKey: string;
  agentId: string;
  sessionType?: string;
  model?: string;
  requestedSkills?: string[];
  stopSupported?: boolean;
  stopReason?: string;
  restoreDraftOnError?: boolean;
  sendPolicy?: 'interrupt-and-send' | 'enqueue';
};

export type UseChatStreamControllerParams = {
  nextOptimisticUserSeq: number;
  selectedSessionKeyRef: MutableRefObject<string | null>;
  setSelectedSessionKey: Dispatch<SetStateAction<string | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
  refetchSessions: () => Promise<unknown>;
  refetchHistory: () => Promise<unknown>;
};

export type NumberRef = MutableRefObject<number>;

export type StreamSetters = {
  setOptimisticUserEvent: Dispatch<SetStateAction<SessionEventView | null>>;
  setStreamingSessionEvents: Dispatch<SetStateAction<SessionEventView[]>>;
  setStreamingAssistantText: Dispatch<SetStateAction<string>>;
  setStreamingAssistantTimestamp: Dispatch<SetStateAction<string | null>>;
  setActiveBackendRunId: Dispatch<SetStateAction<string | null>>;
  setIsSending: Dispatch<SetStateAction<boolean>>;
  setIsAwaitingAssistantOutput: Dispatch<SetStateAction<boolean>>;
  setCanStopCurrentRun: Dispatch<SetStateAction<boolean>>;
  setStopDisabledReason: Dispatch<SetStateAction<string | null>>;
  setLastSendError: Dispatch<SetStateAction<string | null>>;
};

export type StreamReadyEvent = {
  runId?: string;
  stopSupported?: boolean;
  stopReason?: string;
  sessionKey: string;
};

export type StreamDeltaEvent = {
  delta: string;
};

export type StreamSessionEvent = {
  data: SessionEventView;
};

export type ExecuteStreamRunParams = {
  runId: number;
  runIdRef: NumberRef;
  activeRunRef: MutableRefObject<ActiveRunState | null>;
  selectedSessionKeyRef: MutableRefObject<string | null>;
  setSelectedSessionKey: Dispatch<SetStateAction<string | null>>;
  setDraft: Dispatch<SetStateAction<string>>;
  refetchSessions: () => Promise<unknown>;
  refetchHistory: () => Promise<unknown>;
  restoreDraftOnError?: boolean;
  sourceSessionKey: string;
  sourceAgentId?: string;
  sourceMessage?: string;
  sourceStopSupported?: boolean;
  sourceStopReason?: string;
  optimisticUserEvent: SessionEventView | null;
  openStream: (params: {
    signal: AbortSignal;
    onReady: (event: StreamReadyEvent) => void;
    onDelta: (event: StreamDeltaEvent) => void;
    onSessionEvent: (event: StreamSessionEvent) => void;
  }) => Promise<{ sessionKey: string; reply: string }>;
  setters: StreamSetters;
};

export type StreamProgress = {
  streamText: string;
  hasAssistantSessionEvent: boolean;
  hasUserSessionEvent: boolean;
};

export type RunContext = {
  params: UseChatStreamControllerParams;
  runIdRef: NumberRef;
  activeRunRef: MutableRefObject<ActiveRunState | null>;
  setters: StreamSetters;
};

export type RunSend = (item: PendingChatMessage, options?: { restoreDraftOnError?: boolean }) => Promise<void>;

export type StopCurrentRun = (options?: { clearQueue?: boolean }) => Promise<void>;

export type QueueSetState = Dispatch<SetStateAction<PendingChatMessage[]>>;

export type SetCanStopState = Dispatch<SetStateAction<boolean>>;

export type SetLastSendErrorState = Dispatch<SetStateAction<string | null>>;

export type ResumePendingRunParams = {
  context: RunContext;
  run: ChatRunView;
  isSending: boolean;
};
