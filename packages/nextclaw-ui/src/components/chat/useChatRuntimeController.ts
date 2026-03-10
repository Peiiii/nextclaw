import { useCallback, useEffect, useRef } from 'react';
import { type AgentChatController, getStopDisabledReason } from '@nextclaw/agent-chat';
import type { ChatRunView, SessionMessageView } from '@/api/types';
import type { SendMessageParams, UseChatStreamControllerParams } from '@/components/chat/chat-stream/types';
import { buildResumeMetadata, buildSendMetadata } from '@/components/chat/chat-stream/nextbot-parsers';
import { buildUiMessagesFromHistoryMessages, normalizeRequestedSkills } from '@/lib/chat-runtime-utils';
import { useValueFromBehaviorSubject, useValueFromObservable } from '@/hooks/useObservable';

export function useChatRuntimeController(
  params: UseChatStreamControllerParams,
  controller: AgentChatController
) {
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  });

  const activeHistorySessionKeyRef = useRef<string | null>(null);

  // Bind callbacks to controller
  useEffect(() => {
    controller.setCallbacks({
      onRunSettled: async ({ sourceSessionId, resultSessionId }) => {
        const bindings = paramsRef.current;
        await bindings.refetchSessions();
        const activeSessionKey = bindings.selectedSessionKeyRef.current;
        if (!activeSessionKey || activeSessionKey === sourceSessionId || (resultSessionId && activeSessionKey === resultSessionId)) {
          await bindings.refetchHistory();
        }
      },
      onRunError: ({ sourceMessage, restoreDraft }) => {
        if (restoreDraft) {
          paramsRef.current.setDraft((prev) => (prev.trim().length === 0 && sourceMessage ? sourceMessage : prev));
        }
      },
      onSessionChanged: (sessionId) => {
        paramsRef.current.setSelectedSessionKey((prev) => (prev === sessionId ? prev : sessionId));
      }
    });
  }, [controller]);

  // Reactive state from controller observables
  const uiMessages = useValueFromObservable(controller.messages$, controller.getMessages());
  const isSending = useValueFromBehaviorSubject(controller.isAgentResponding$);
  const isAwaitingAssistantOutput = useValueFromBehaviorSubject(controller.isAwaitingResponse$);
  const activeRun = useValueFromBehaviorSubject(controller.activeRun$);
  const lastSendError = useValueFromBehaviorSubject(controller.lastError$);

  // Derived state
  const activeBackendRunId = activeRun?.remoteRunId ?? null;
  const stopDisabledReason = getStopDisabledReason(activeRun);
  const canStopCurrentRun = Boolean(
    activeRun && (stopDisabledReason === null || (activeRun.remoteStopCapable && !activeBackendRunId))
  );

  const sendMessage = useCallback(async (payload: SendMessageParams) => {
    const requestedSkills = normalizeRequestedSkills(payload.requestedSkills);
    const metadata = buildSendMetadata(payload, requestedSkills);
    await controller.send({
      message: payload.message,
      sessionId: payload.sessionKey,
      agentId: payload.agentId,
      metadata,
      restoreDraftOnError: payload.restoreDraftOnError,
      stopCapable: payload.stopSupported,
      stopReason: payload.stopReason
    });
  }, [controller]);

  const resumeRun = useCallback(async (run: ChatRunView) => {
    const backendRunId = run.runId?.trim();
    const sessionKey = run.sessionKey?.trim();
    if (!backendRunId || !sessionKey) {
      return;
    }
    const metadata = buildResumeMetadata(run);
    await controller.resume({
      remoteRunId: backendRunId,
      sessionId: sessionKey,
      agentId: run.agentId,
      metadata,
      stopCapable: run.stopSupported,
      stopReason: run.stopReason
    });
  }, [controller]);

  const stopCurrentRun = useCallback(async () => {
    await controller.stop();
  }, [controller]);

  const resetStreamState = useCallback(() => {
    activeHistorySessionKeyRef.current = null;
    controller.reset();
  }, [controller]);

  const applyHistoryMessages = useCallback((messages: SessionMessageView[], options?: { isLoading?: boolean }) => {
    const isRunActive = Boolean(controller.activeRun$.getValue() || controller.isAgentResponding$.getValue());
    if (isRunActive) {
      return;
    }
    const selectedSessionKey = paramsRef.current.selectedSessionKeyRef.current;
    if (selectedSessionKey !== activeHistorySessionKeyRef.current) {
      activeHistorySessionKeyRef.current = selectedSessionKey;
      if (controller.getMessages().length > 0) {
        controller.setMessages([]);
      }
    }
    if (!selectedSessionKey) {
      if (controller.getMessages().length > 0) {
        controller.setMessages([]);
      }
      return;
    }
    if (options?.isLoading && messages.length === 0) {
      return;
    }
    controller.setMessages(buildUiMessagesFromHistoryMessages(messages));
  }, [controller]);

  return {
    uiMessages,
    isSending,
    isAwaitingAssistantOutput,
    canStopCurrentRun,
    stopDisabledReason,
    lastSendError,
    activeBackendRunId,
    sendMessage,
    stopCurrentRun,
    resumeRun,
    resetStreamState,
    applyHistoryMessages
  };
}
