import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useSessionRunStatus } from '@/components/chat/chat-page-runtime';
import { useChatPageData, sessionDisplayName } from '@/components/chat/chat-page-data';
import { ChatPageLayout, type ChatPageProps, useChatSessionSync } from '@/components/chat/chat-page-shell';
import { parseSessionKeyFromRoute, resolveAgentIdFromSessionKey } from '@/components/chat/chat-session-route';
import { ChatPresenterProvider } from '@/components/chat/presenter/chat-presenter-context';
import { ChatPresenter } from '@/components/chat/presenter/chat.presenter';
import { useChatRuntimeController } from '@/components/chat/useChatRuntimeController';
import { resolveSessionTypeLabel } from '@/components/chat/useChatSessionTypeState';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';

export function LegacyChatPage({ view }: ChatPageProps) {
  const [presenter] = useState(() => new ChatPresenter());
  const query = useChatSessionListStore((state) => state.snapshot.query);
  const selectedSessionKey = useChatSessionListStore((state) => state.snapshot.selectedSessionKey);
  const selectedAgentId = useChatSessionListStore((state) => state.snapshot.selectedAgentId);
  const pendingSessionType = useChatInputStore((state) => state.snapshot.pendingSessionType);
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId: routeSessionIdParam } = useParams<{ sessionId?: string }>();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const selectedSessionKeyRef = useRef<string | null>(selectedSessionKey);
  const modelHydratedSessionKeyRef = useRef<string | null>(null);
  const thinkingHydratedSessionKeyRef = useRef<string | null>(null);
  const routeSessionKey = useMemo(
    () => parseSessionKeyFromRoute(routeSessionIdParam),
    [routeSessionIdParam]
  );
  const {
    sessionsQuery,
    installedSkillsQuery,
    chatCapabilitiesQuery,
    historyQuery,
    isProviderStateResolved,
    modelOptions,
    sessions,
    skillRecords,
    selectedSession,
    hydratedSessionModel,
    historyMessages,
    selectedSessionThinkingLevel,
    sessionTypeOptions,
    defaultSessionType,
    selectedSessionType,
    canEditSessionType,
    sessionTypeUnavailable,
    sessionTypeUnavailableMessage
  } = useChatPageData({
    query,
    selectedSessionKey,
    selectedAgentId,
    pendingSessionType,
    setPendingSessionType: presenter.chatInputManager.setPendingSessionType,
    setSelectedModel: presenter.chatInputManager.setSelectedModel
  });
  const {
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
  } = useChatRuntimeController(
    {
      selectedSessionKeyRef,
      setSelectedSessionKey: presenter.chatSessionListManager.setSelectedSessionKey,
      setDraft: presenter.chatInputManager.setDraft,
      refetchSessions: sessionsQuery.refetch,
      refetchHistory: historyQuery.refetch
    },
    presenter.chatController
  );

  useEffect(() => {
    presenter.chatStreamActionsManager.bind({
      sendMessage,
      stopCurrentRun,
      resumeRun,
      resetStreamState,
      applyHistoryMessages
    });
  }, [applyHistoryMessages, presenter, resetStreamState, resumeRun, sendMessage, stopCurrentRun]);

  const { sessionRunStatusByKey } = useSessionRunStatus({
    view,
    selectedSessionKey,
    activeBackendRunId,
    isLocallyRunning: isSending || Boolean(activeBackendRunId),
    resumeRun: presenter.chatStreamActionsManager.resumeRun
  });

  useChatSessionSync({
    view,
    routeSessionKey,
    selectedSessionKey,
    selectedAgentId,
    setSelectedSessionKey: presenter.chatSessionListManager.setSelectedSessionKey,
    setSelectedAgentId: presenter.chatSessionListManager.setSelectedAgentId,
    selectedSessionKeyRef,
    resetStreamState: presenter.chatStreamActionsManager.resetStreamState,
    resolveAgentIdFromSessionKey
  });

  useEffect(() => {
    presenter.chatStreamActionsManager.applyHistoryMessages(historyMessages, {
      isLoading: historyQuery.isLoading
    });
  }, [historyMessages, historyQuery.isLoading, presenter]);

  useEffect(() => {
    presenter.chatUiManager.syncState({
      pathname: location.pathname
    });
    presenter.chatUiManager.bindActions({
      navigate,
      confirm
    });
  }, [confirm, location.pathname, navigate, presenter]);

  const currentSessionDisplayName = selectedSession ? sessionDisplayName(selectedSession) : undefined;
  const currentSessionTypeLabel =
    sessionTypeOptions.find((option) => option.value === selectedSessionType)?.label ??
    resolveSessionTypeLabel(selectedSessionType);

  useEffect(() => {
    presenter.chatThreadManager.bindActions({
      refetchSessions: sessionsQuery.refetch
    });
  }, [presenter, sessionsQuery.refetch]);

  useEffect(() => {
    const shouldHydrateModelFromSession =
      !isSending &&
      !isAwaitingAssistantOutput &&
      !sessionsQuery.isLoading &&
      isProviderStateResolved &&
      modelOptions.length > 0 &&
      selectedSessionKey !== modelHydratedSessionKeyRef.current;
    const shouldHydrateThinkingFromHistory =
      !isSending &&
      !isAwaitingAssistantOutput &&
      !historyQuery.isLoading &&
      isProviderStateResolved &&
      modelOptions.length > 0 &&
      selectedSessionKey !== thinkingHydratedSessionKeyRef.current;

    presenter.chatInputManager.syncSnapshot({
      isProviderStateResolved,
      defaultSessionType,
      canStopGeneration: canStopCurrentRun,
      stopDisabledReason,
      stopSupported: chatCapabilitiesQuery.data?.stopSupported ?? false,
      stopReason: chatCapabilitiesQuery.data?.stopReason,
      sendError: lastSendError,
      isSending,
      modelOptions,
      ...(shouldHydrateModelFromSession ? { selectedModel: hydratedSessionModel } : {}),
      sessionTypeOptions,
      selectedSessionType,
      ...(shouldHydrateThinkingFromHistory ? { selectedThinkingLevel: selectedSessionThinkingLevel } : {}),
      canEditSessionType,
      sessionTypeUnavailable,
      skillRecords,
      isSkillsLoading: installedSkillsQuery.isLoading
    });
    if (shouldHydrateModelFromSession) {
      modelHydratedSessionKeyRef.current = selectedSessionKey;
    }
    if (shouldHydrateThinkingFromHistory) {
      thinkingHydratedSessionKeyRef.current = selectedSessionKey;
    }
    if (!selectedSessionKey) {
      modelHydratedSessionKeyRef.current = null;
      thinkingHydratedSessionKeyRef.current = null;
    }
    presenter.chatSessionListManager.syncSnapshot({
      sessions,
      query,
      isLoading: sessionsQuery.isLoading
    });
    presenter.chatRunStatusManager.syncSnapshot({
      sessionRunStatusByKey,
      isLocallyRunning: isSending || Boolean(activeBackendRunId),
      activeBackendRunId
    });
    presenter.chatThreadManager.syncSnapshot({
      isProviderStateResolved,
      modelOptions,
      sessionTypeUnavailable,
      sessionTypeUnavailableMessage,
      sessionTypeLabel: currentSessionTypeLabel,
      selectedSessionKey,
      sessionDisplayName: currentSessionDisplayName,
      canDeleteSession: Boolean(selectedSession),
      threadRef,
      isHistoryLoading: historyQuery.isLoading,
      uiMessages,
      isSending,
      isAwaitingAssistantOutput
    });
  }, [
    activeBackendRunId,
    canEditSessionType,
    canStopCurrentRun,
    currentSessionDisplayName,
    currentSessionTypeLabel,
    chatCapabilitiesQuery.data?.stopReason,
    chatCapabilitiesQuery.data?.stopSupported,
    defaultSessionType,
    historyQuery.isLoading,
    installedSkillsQuery.isLoading,
    isAwaitingAssistantOutput,
    hydratedSessionModel,
    isProviderStateResolved,
    isSending,
    lastSendError,
    modelOptions.length,
    modelOptions,
    presenter,
    query,
    selectedSession,
    selectedSessionKey,
    selectedSessionThinkingLevel,
    selectedSessionType,
    sessionRunStatusByKey,
    sessionTypeOptions,
    sessionTypeUnavailable,
    sessionTypeUnavailableMessage,
    sessions,
    sessionsQuery.isLoading,
    skillRecords,
    stopDisabledReason,
    threadRef,
    uiMessages
  ]);

  return (
    <ChatPresenterProvider presenter={presenter}>
      <ChatPageLayout view={view} confirmDialog={<ConfirmDialog />} />
    </ChatPresenterProvider>
  );
}
