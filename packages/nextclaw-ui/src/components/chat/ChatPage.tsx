import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatConversationPanel } from '@/components/chat/ChatConversationPanel';
import { CronConfig } from '@/components/config/CronConfig';
import { MarketplacePage } from '@/components/marketplace/MarketplacePage';
import { useSessionRunStatus } from '@/components/chat/chat-page-runtime';
import { useChatRuntimeController } from '@/components/chat/useChatRuntimeController';
import { parseSessionKeyFromRoute, resolveAgentIdFromSessionKey } from '@/components/chat/chat-session-route';
import { useChatPageData, sessionDisplayName } from '@/components/chat/chat-page-data';
import { ChatPresenterProvider } from '@/components/chat/presenter/chat-presenter-context';
import { ChatPresenter } from '@/components/chat/presenter/chat.presenter';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

type MainPanelView = 'chat' | 'cron' | 'skills';

type ChatPageProps = {
  view: MainPanelView;
};

type UseSessionSyncParams = {
  view: MainPanelView;
  routeSessionKey: string | null;
  selectedSessionKey: string | null;
  selectedAgentId: string;
  setSelectedSessionKey: Dispatch<SetStateAction<string | null>>;
  setSelectedAgentId: Dispatch<SetStateAction<string>>;
  selectedSessionKeyRef: MutableRefObject<string | null>;
  resetStreamState: () => void;
};

function useChatSessionSync(params: UseSessionSyncParams): void {
  const {
    view,
    routeSessionKey,
    selectedSessionKey,
    selectedAgentId,
    setSelectedSessionKey,
    setSelectedAgentId,
    selectedSessionKeyRef,
    resetStreamState
  } = params;

  useEffect(() => {
    if (view !== 'chat') {
      return;
    }
    if (routeSessionKey) {
      if (selectedSessionKey !== routeSessionKey) {
        setSelectedSessionKey(routeSessionKey);
      }
      return;
    }
    if (selectedSessionKey !== null) {
      setSelectedSessionKey(null);
      resetStreamState();
    }
  }, [resetStreamState, routeSessionKey, selectedSessionKey, setSelectedSessionKey, view]);

  useEffect(() => {
    const inferred = selectedSessionKey ? resolveAgentIdFromSessionKey(selectedSessionKey) : null;
    if (!inferred) {
      return;
    }
    if (selectedAgentId !== inferred) {
      setSelectedAgentId(inferred);
    }
  }, [selectedAgentId, selectedSessionKey, setSelectedAgentId]);

  useEffect(() => {
    selectedSessionKeyRef.current = selectedSessionKey;
  }, [selectedSessionKey, selectedSessionKeyRef]);
}

type ChatPageLayoutProps = {
  view: MainPanelView;
  confirmDialog: JSX.Element;
};

function ChatPageLayout({ view, confirmDialog }: ChatPageLayoutProps) {
  return (
    <div className="h-full flex">
      <ChatSidebar />

      {view === 'chat' ? (
        <ChatConversationPanel />
      ) : (
        <section className="flex-1 min-h-0 overflow-hidden bg-gradient-to-b from-gray-50/60 to-white">
          {view === 'cron' ? (
            <div className="h-full overflow-auto custom-scrollbar">
              <div className="mx-auto w-full max-w-[min(1120px,100%)] px-6 py-5">
                <CronConfig />
              </div>
            </div>
          ) : (
            <div className="h-full overflow-hidden">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-[min(1120px,100%)] flex-col px-6 py-5">
                <MarketplacePage forcedType="skills" />
              </div>
            </div>
          )}
        </section>
      )}

      {confirmDialog}
    </div>
  );
}

export function ChatPage({ view }: ChatPageProps) {
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
    historyMessages,
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

  console.log('[ChatPage] uiMessages', { uiMessages, historyMessages });
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
    resetStreamState: presenter.chatStreamActionsManager.resetStreamState
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

  useEffect(() => {
    presenter.chatThreadManager.bindActions({
      refetchSessions: sessionsQuery.refetch
    });
  }, [
    presenter,
    sessionsQuery.refetch,
  ]);

  useEffect(() => {
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
      sessionTypeOptions,
      selectedSessionType,
      canEditSessionType,
      sessionTypeUnavailable,
      skillRecords,
      isSkillsLoading: installedSkillsQuery.isLoading
    });
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
    chatCapabilitiesQuery.data?.stopReason,
    chatCapabilitiesQuery.data?.stopSupported,
    defaultSessionType,
    historyQuery.isLoading,
    installedSkillsQuery.isLoading,
    isAwaitingAssistantOutput,
    isProviderStateResolved,
    isSending,
    lastSendError,
    uiMessages,
    modelOptions,
    presenter,
    query,
    selectedSession,
    selectedSessionKey,
    selectedAgentId,
    selectedSessionType,
    sessionRunStatusByKey,
    sessionTypeOptions,
    sessionTypeUnavailable,
    sessionTypeUnavailableMessage,
    sessions,
    sessionsQuery.isLoading,
    stopDisabledReason,
    threadRef,
    skillRecords
  ]);

  return (
    <ChatPresenterProvider presenter={presenter}>
      <ChatPageLayout view={view} confirmDialog={<ConfirmDialog />} />
    </ChatPresenterProvider>
  );
}
