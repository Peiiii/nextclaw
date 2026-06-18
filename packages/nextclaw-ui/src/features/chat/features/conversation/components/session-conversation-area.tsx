import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { useAppPresenter } from '@/app/components/app-presenter-provider';
import { ChatConversationContent } from '@/features/chat/components/conversation/chat-conversation-content';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import {
  isNcpAgentStartupUnavailableErrorMessage,
  useNcpSessionConversation,
} from '@/features/chat/features/ncp/hooks/use-ncp-session-conversation';
import { isNcpChatRuntimeBlocked, resolveNcpChatSendErrorMessage } from '@/features/chat/features/runtime/utils/ncp-chat-runtime-availability.utils';
import { buildChatContextWindowIndicator } from '@/features/chat/features/session/utils/chat-context-window-indicator.utils';
import { readNcpContextWindowValue } from '@/features/chat/features/session/utils/ncp-session-context-metadata.utils';
import { ChatConversationWelcome } from '@/features/chat/features/welcome/components/chat-conversation-welcome';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useSystemStatus } from '@/features/system-status';
import { t } from '@/shared/lib/i18n';

import { useSessionConversationController } from '@/features/chat/features/conversation/hooks/use-session-conversation-controller';
import { useSessionConversationInputQuery } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-query';
import { useSessionConversationInputState } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';
import { SessionConversationInput } from './session-conversation-input';

type SessionConversationAreaProps = {
  readonly consumeDraftIntent?: boolean;
  readonly onSessionMaterialized?: (sessionKey: string) => void;
  readonly sessionKey: string | null;
};

function useSessionConversationDraftIntent(params: {
  readonly consumeDraftIntent: boolean;
  readonly applyPromptSuggestion: (prompt: string) => void;
}) {
  const { applyPromptSuggestion, consumeDraftIntent } = params;
  const appPresenter = useAppPresenter();
  const presenter = usePresenter();
  useEffect(() => {
    if (!consumeDraftIntent) {
      return undefined;
    }
    const applyIntent = (intent: { id: number; prompt: string }) => {
      presenter.chatSessionListManager.createSession();
      presenter.chatSessionListManager.setSelectedAgentId('main');
      applyPromptSuggestion(intent.prompt);
      appPresenter.chatDraftIntentManager.markConsumed(intent.id);
    };
    const unsubscribe = appPresenter.chatDraftIntentManager.subscribe(applyIntent);
    const pendingIntent = appPresenter.chatDraftIntentManager.consumePending();
    if (pendingIntent) {
      applyIntent(pendingIntent);
    }
    return unsubscribe;
  }, [
    appPresenter,
    applyPromptSuggestion,
    consumeDraftIntent,
    presenter,
  ]);
}

type ChatDraftRouteState = {
  readonly sessionType?: unknown;
  readonly projectRoot?: unknown;
};

function readChatDraftRouteState(value: unknown): ChatDraftRouteState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const draft = (value as { chatDraft?: unknown }).chatDraft;
  if (!draft || typeof draft !== 'object') {
    return null;
  }
  return draft as ChatDraftRouteState;
}

function useSessionConversationDraftRouteState(params: {
  readonly sessionKey: string | null;
  readonly setPendingProjectRoot: (projectRoot: string | null) => void;
  readonly setPendingSessionType: (sessionType: string) => void;
}) {
  const {
    sessionKey,
    setPendingProjectRoot,
    setPendingSessionType,
  } = params;
  const location = useLocation();
  const appliedRouteStateKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (sessionKey) {
      return;
    }
    const draftState = readChatDraftRouteState(location.state);
    if (!draftState) {
      return;
    }
    const signature = [
      location.key,
      typeof draftState.sessionType === 'string' ? draftState.sessionType : '',
      typeof draftState.projectRoot === 'string' ? draftState.projectRoot : '',
    ].join(':');
    if (appliedRouteStateKeyRef.current === signature) {
      return;
    }
    appliedRouteStateKeyRef.current = signature;
    if (typeof draftState.sessionType === 'string' && draftState.sessionType.trim()) {
      setPendingSessionType(draftState.sessionType);
    }
    setPendingProjectRoot(
      typeof draftState.projectRoot === 'string' && draftState.projectRoot.trim()
        ? draftState.projectRoot
        : null,
    );
  }, [
    location.key,
    location.state,
    sessionKey,
    setPendingProjectRoot,
    setPendingSessionType,
  ]);
}

function SessionConversationAlerts({
  inputQuery,
}: {
  readonly inputQuery: ReturnType<typeof useSessionConversationInputQuery>;
}) {
  const presenter = usePresenter();
  const shouldShowProviderHint =
    inputQuery.isProviderStateResolved && inputQuery.modelOptions.length === 0;
  const sessionTypeUnavailableMessage =
    inputQuery.sessionTypeState.sessionTypeUnavailableMessage?.trim() || null;

  return (
    <>
      {shouldShowProviderHint ? (
        <div className="px-4 py-2.5 border-b border-amber-200/70 bg-amber-50/70 flex items-center justify-between gap-3 shrink-0 sm:px-5">
          <span className="text-xs text-amber-800">
            {t('chatModelNoOptions')}
          </span>
          <button
            type="button"
            onClick={presenter.chatUiManager.goToProviders}
            className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
          >
            {t('chatGoConfigureProvider')}
          </button>
        </div>
      ) : null}
      {inputQuery.sessionTypeState.sessionTypeUnavailable && sessionTypeUnavailableMessage ? (
        <div className="px-4 py-2.5 border-b border-amber-200/70 bg-amber-50/70 shrink-0 sm:px-5">
          <span className="text-xs text-amber-800">
            {sessionTypeUnavailableMessage}
          </span>
        </div>
      ) : null}
    </>
  );
}

export function SessionConversationArea(props: SessionConversationAreaProps) {
  const {
    consumeDraftIntent = false,
    onSessionMaterialized,
    sessionKey,
  } = props;
  const systemStatus = useSystemStatus();
  const selectedAgentId = useChatSessionListStore(
    (state) => state.snapshot.selectedAgentId,
  );
  const agent = useNcpSessionConversation(sessionKey ?? undefined);
  const {
    inputActions,
    inputSnapshot,
  } = useSessionConversationInputState();
  const inputQuery = useSessionConversationInputQuery({
    sessionKey,
    inputSnapshot,
    setPendingSessionType: inputActions.setPendingSessionType,
  });
  useSessionConversationDraftRouteState({
    sessionKey,
    setPendingProjectRoot: inputActions.setPendingProjectRoot,
    setPendingSessionType: inputActions.setPendingSessionType,
  });
  const isRuntimeBlocked = isNcpChatRuntimeBlocked(systemStatus);
  const currentSessionRunning = agent.isRunning || inputQuery.selectedSession?.status === 'running';
  const rawLastSendError =
    agent.hydrateError?.message ?? agent.snapshot.error?.message ?? null;
  const filteredLastSendError =
    systemStatus.phase === 'ready' &&
    isNcpAgentStartupUnavailableErrorMessage(rawLastSendError)
      ? null
      : rawLastSendError;
  const lastSendError =
    isRuntimeBlocked
      ? null
      : systemStatus.phase === 'ready'
      ? filteredLastSendError
      : resolveNcpChatSendErrorMessage({
          message: filteredLastSendError,
          status: systemStatus,
        });
  const controllerAgent = useMemo(() => ({
    ...agent,
    isRunning: currentSessionRunning,
    isSending: agent.isSending || currentSessionRunning,
  }), [agent, currentSessionRunning]);
  const controller = useSessionConversationController({
    agent: controllerAgent,
    inputSnapshot,
    inputQuery,
    isRuntimeBlocked,
    selectedAgentId,
    sessionKey,
    onSessionMaterialized,
    resetComposer: inputActions.resetComposer,
    restoreComposer: inputActions.restoreComposer,
    setSendError: inputActions.setSendError,
  });
  const displayInputSnapshot = useMemo(() => ({
    ...inputSnapshot,
    sendError: lastSendError ?? inputSnapshot.sendError,
  }), [inputSnapshot, lastSendError]);
  const contextWindow = useMemo(
    () => buildChatContextWindowIndicator(readNcpContextWindowValue(agent.snapshot.contextWindow)),
    [agent.snapshot.contextWindow],
  );
  useSessionConversationDraftIntent({
    consumeDraftIntent,
    applyPromptSuggestion: inputActions.applyPromptSuggestion,
  });
  const renderInput = useCallback((surface: 'default' | 'embedded') => (
    <SessionConversationInput
      contextWindow={contextWindow}
      controller={controller}
      inputActions={inputActions}
      inputQuery={inputQuery}
      inputSnapshot={displayInputSnapshot}
      surface={surface}
    />
  ), [
    contextWindow,
    controller,
    displayInputSnapshot,
    inputActions,
    inputQuery,
  ]);
  const showWelcome =
    !sessionKey &&
    agent.visibleMessages.length === 0 &&
    !agent.isHydrating &&
    !controller.isSending;

  return (
    <>
      <SessionConversationAlerts inputQuery={inputQuery} />
      <ChatConversationContent
        isAwaitingAssistantOutput={controller.isSending && currentSessionRunning}
        isHistoryLoading={agent.isHydrating}
        isSending={controller.isSending}
        messages={agent.visibleMessages}
        sessionKey={sessionKey}
        showWelcome={showWelcome}
        welcomeSlot={
          <ChatConversationWelcome
            inputSlot={renderInput('embedded')}
            pendingProjectRoot={inputSnapshot.pendingProjectRoot}
            pendingSessionType={inputSnapshot.pendingSessionType}
            selectedSessionTypeValue={inputSnapshot.selectedSessionType}
            onSelectProjectRoot={inputActions.setPendingProjectRoot}
            onSelectPrompt={inputActions.applyPromptSuggestion}
            onSelectSessionType={inputActions.setPendingSessionType}
          />
        }
      />
      {showWelcome ? null : renderInput('default')}
    </>
  );
}
