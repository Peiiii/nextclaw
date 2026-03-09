import type { ChatRunView } from '@/api/types';
import { openResumeRunStream, openSendTurnStream, requestStopRun } from './transport';
import {
  buildOptimisticUserEvent,
  clearStreamingState,
  executeStreamRun,
  normalizeRequestedSkills
} from './stream-run-controller';
import type {
  NumberRef,
  PendingChatMessage,
  QueueSetState,
  RunContext,
  RunSend,
  SendMessageParams,
  SetCanStopState,
  SetLastSendErrorState,
  StopCurrentRun,
  StreamSetters
} from './types';

function buildPendingChatMessage(queueId: number, payload: SendMessageParams): PendingChatMessage {
  return {
    id: queueId,
    message: payload.message,
    sessionKey: payload.sessionKey,
    agentId: payload.agentId,
    ...(payload.sessionType ? { sessionType: payload.sessionType } : {}),
    ...(payload.model ? { model: payload.model } : {}),
    ...(payload.requestedSkills && payload.requestedSkills.length > 0
      ? { requestedSkills: payload.requestedSkills }
      : {}),
    ...(typeof payload.stopSupported === 'boolean' ? { stopSupported: payload.stopSupported } : {}),
    ...(payload.stopReason ? { stopReason: payload.stopReason } : {})
  };
}

export class ChatStreamFlowController {
  constructor(private readonly deps: {
    getContext: () => RunContext;
    getIsSending: () => boolean;
    queueIdRef: NumberRef;
    activeRunRef: RunContext['activeRunRef'];
    setQueuedMessages: QueueSetState;
    runSend: RunSend;
    stopCurrentRun: StopCurrentRun;
    setCanStopCurrentRun: SetCanStopState;
    setLastSendError: SetLastSendErrorState;
    setters: StreamSetters;
  }) {}

  resetStreamingState = () => {
    clearStreamingState(this.deps.setters);
  };

  reorderQueuedMessageToFront = (id: number, prev: PendingChatMessage[]) => {
    const index = prev.findIndex((item) => item.id === id);
    if (index <= 0) {
      return prev;
    }

    const next = [...prev];
    const [picked] = next.splice(index, 1);
    next.unshift(picked);
    return next;
  };

  executeSendPendingMessage = async (
    item: PendingChatMessage,
    options?: { restoreDraftOnError?: boolean }
  ) => {
    const context = this.deps.getContext();
    const requestedSkills = normalizeRequestedSkills(item.requestedSkills);

    context.setters.setLastSendError(null);
    context.runIdRef.current += 1;

    await executeStreamRun({
      runId: context.runIdRef.current,
      runIdRef: context.runIdRef,
      activeRunRef: context.activeRunRef,
      selectedSessionKeyRef: context.params.selectedSessionKeyRef,
      setSelectedSessionKey: context.params.setSelectedSessionKey,
      setDraft: context.params.setDraft,
      refetchSessions: context.params.refetchSessions,
      refetchHistory: context.params.refetchHistory,
      restoreDraftOnError: options?.restoreDraftOnError,
      sourceSessionKey: item.sessionKey,
      sourceAgentId: item.agentId,
      sourceMessage: item.message,
      sourceStopSupported: item.stopSupported,
      sourceStopReason: item.stopReason,
      optimisticUserEvent: buildOptimisticUserEvent(context.params.nextOptimisticUserSeq, item.message),
      openStream: ({ signal, onReady, onDelta, onSessionEvent }) =>
        openSendTurnStream({
          item,
          requestedSkills,
          signal,
          onReady,
          onDelta,
          onSessionEvent
        }),
      setters: context.setters
    });
  };

  executeResumePendingRun = async (run: ChatRunView) => {
    const runId = run.runId?.trim();
    const sessionKey = run.sessionKey?.trim();
    if (!runId || !sessionKey) {
      return;
    }

    const context = this.deps.getContext();
    const active = context.activeRunRef.current;
    if (active?.backendRunId === runId) {
      return;
    }
    if (active || this.deps.getIsSending()) {
      return;
    }

    context.setters.setLastSendError(null);
    context.runIdRef.current += 1;

    await executeStreamRun({
      runId: context.runIdRef.current,
      runIdRef: context.runIdRef,
      activeRunRef: context.activeRunRef,
      selectedSessionKeyRef: context.params.selectedSessionKeyRef,
      setSelectedSessionKey: context.params.setSelectedSessionKey,
      setDraft: context.params.setDraft,
      refetchSessions: context.params.refetchSessions,
      refetchHistory: context.params.refetchHistory,
      sourceSessionKey: sessionKey,
      sourceAgentId: run.agentId,
      sourceStopSupported: run.stopSupported,
      sourceStopReason: run.stopReason,
      optimisticUserEvent: null,
      openStream: ({ signal, onReady, onDelta, onSessionEvent }) =>
        openResumeRunStream({
          runId,
          signal,
          onReady,
          onDelta,
          onSessionEvent
        }),
      setters: context.setters
    });
  };

  executeStopActiveRun = async (options?: { clearQueue?: boolean }) => {
    const activeRun = this.deps.activeRunRef.current;
    if (!activeRun) {
      return;
    }

    if (options?.clearQueue ?? true) {
      this.deps.setQueuedMessages([]);
    }

    this.deps.setCanStopCurrentRun(false);
    activeRun.requestAbortController.abort();
    if (activeRun.backendStopSupported) {
      void requestStopRun(activeRun);
    }
  };

  executeSendMessagePolicy = async (payload: SendMessageParams) => {
    this.deps.setLastSendError(null);
    this.deps.queueIdRef.current += 1;
    const item = buildPendingChatMessage(this.deps.queueIdRef.current, payload);
    const sendPolicy = payload.sendPolicy ?? 'interrupt-and-send';
    const hasActiveRun = Boolean(this.deps.activeRunRef.current);
    const isRunning = this.deps.getIsSending() || hasActiveRun;

    if (isRunning) {
      if (sendPolicy === 'interrupt-and-send') {
        if (!hasActiveRun) {
          await this.deps.runSend(item, { restoreDraftOnError: payload.restoreDraftOnError });
          return;
        }
        this.deps.setQueuedMessages((prev) => [item, ...prev]);
        void this.deps.stopCurrentRun({ clearQueue: false });
        return;
      }

      this.deps.setQueuedMessages((prev) => [...prev, item]);
      return;
    }

    await this.deps.runSend(item, { restoreDraftOnError: payload.restoreDraftOnError });
  };
}
