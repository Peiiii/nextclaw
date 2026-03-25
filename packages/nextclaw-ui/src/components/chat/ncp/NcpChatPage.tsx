import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NcpHttpAgentClientEndpoint } from '@nextclaw/ncp-http-agent-client';
import {
  buildNcpRequestEnvelope,
  useHydratedNcpAgent,
  type NcpConversationSeed
} from '@nextclaw/ncp-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { API_BASE } from '@/api/api-base';
import { fetchNcpSessionMessages } from '@/api/ncp-session';
import type { ChatRunView } from '@/api/types';
import { sessionDisplayName } from '@/components/chat/chat-page-data';
import { ChatPageLayout, type ChatPageProps, useChatSessionSync } from '@/components/chat/chat-page-shell';
import { createNcpAppClientFetch } from '@/components/chat/ncp/ncp-app-client-fetch';
import { parseSessionKeyFromRoute, resolveAgentIdFromSessionKey } from '@/components/chat/chat-session-route';
import { useNcpChatPageData } from '@/components/chat/ncp/ncp-chat-page-data';
import { NcpChatPresenter } from '@/components/chat/ncp/ncp-chat.presenter';
import { adaptNcpMessagesToUiMessages, buildNcpSessionRunStatusByKey, createNcpSessionId } from '@/components/chat/ncp/ncp-session-adapter';
import { ChatPresenterProvider } from '@/components/chat/presenter/chat-presenter-context';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { resolveSessionTypeLabel } from '@/components/chat/useChatSessionTypeState';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { normalizeRequestedSkills } from '@/lib/chat-runtime-utils';

function buildNcpSendMetadata(payload: {
  model?: string;
  thinkingLevel?: string;
  sessionType?: string;
  requestedSkills?: string[];
}): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (payload.model?.trim()) {
    metadata.model = payload.model.trim();
    metadata.preferred_model = payload.model.trim();
  }
  if (payload.thinkingLevel?.trim()) {
    metadata.thinking = payload.thinkingLevel.trim();
    metadata.preferred_thinking = payload.thinkingLevel.trim();
  }
  if (payload.sessionType?.trim()) {
    metadata.session_type = payload.sessionType.trim();
  }
  const requestedSkills = normalizeRequestedSkills(payload.requestedSkills);
  if (requestedSkills.length > 0) {
    metadata.requested_skills = requestedSkills;
  }
  return metadata;
}

function isMissingNcpSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes('ncp session not found:');
}

export function NcpChatPage({ view }: ChatPageProps) {
  const [presenter] = useState(() => new NcpChatPresenter());
  const [draftSessionId, setDraftSessionId] = useState(() => createNcpSessionId());
  const query = useChatSessionListStore((state) => state.snapshot.query);
  const selectedSessionKey = useChatSessionListStore((state) => state.snapshot.selectedSessionKey);
  const selectedAgentId = useChatSessionListStore((state) => state.snapshot.selectedAgentId);
  const pendingSessionType = useChatInputStore((state) => state.snapshot.pendingSessionType);
  const currentSelectedModel = useChatInputStore((state) => state.snapshot.selectedModel);
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
    isProviderStateResolved,
    modelOptions,
    sessionSummaries,
    sessions,
    skillRecords,
    selectedSession,
    sessionTypeOptions,
    defaultSessionType,
    selectedSessionType,
    canEditSessionType,
    sessionTypeUnavailable,
    sessionTypeUnavailableMessage
  } = useNcpChatPageData({
    query,
    selectedSessionKey,
    currentSelectedModel,
    pendingSessionType,
    setPendingSessionType: presenter.chatInputManager.setPendingSessionType,
    setSelectedModel: presenter.chatInputManager.setSelectedModel,
    setSelectedThinkingLevel: presenter.chatInputManager.setSelectedThinkingLevel
  });
  const refetchSessions = sessionsQuery.refetch;

  const activeSessionId = selectedSessionKey ?? draftSessionId;
  const sessionSummariesRef = useRef(sessionSummaries);
  useEffect(() => {
    sessionSummariesRef.current = sessionSummaries;
  }, [sessionSummaries]);

  const [ncpClient] = useState(
    () =>
      new NcpHttpAgentClientEndpoint({
      baseUrl: API_BASE,
      basePath: '/api/ncp/agent',
      fetchImpl: createNcpAppClientFetch()
      })
  );

  const loadSeed = useCallback(async (sessionId: string, signal: AbortSignal): Promise<NcpConversationSeed> => {
    signal.throwIfAborted();
    let history: Awaited<ReturnType<typeof fetchNcpSessionMessages>> | null = null;
    try {
      history = await fetchNcpSessionMessages(sessionId, 300);
    } catch (error) {
      if (!isMissingNcpSessionError(error)) {
        throw error;
      }
    }
    signal.throwIfAborted();

    const sessionSummary = sessionSummariesRef.current.find((item) => item.sessionId === sessionId) ?? null;
    return {
      messages: history?.messages ?? [],
      status: sessionSummary?.status === 'running' ? 'running' : 'idle'
    };
  }, []);

  const agent = useHydratedNcpAgent({
    sessionId: activeSessionId,
    client: ncpClient,
    loadSeed
  });

  useEffect(() => {
    presenter.setDraftSessionId(draftSessionId);
  }, [draftSessionId, presenter]);

  useEffect(() => {
    if (selectedSessionKey === null) {
      const nextDraftSessionId = createNcpSessionId();
      setDraftSessionId(nextDraftSessionId);
      presenter.setDraftSessionId(nextDraftSessionId);
    }
  }, [presenter, selectedSessionKey]);

  const uiMessages = useMemo(
    () => adaptNcpMessagesToUiMessages(agent.visibleMessages),
    [agent.visibleMessages]
  );
  const isSending = agent.isSending || agent.isRunning;
  const isAwaitingAssistantOutput = agent.isRunning;
  const canStopCurrentRun = agent.isRunning;
  const stopDisabledReason = agent.isRunning ? null : '__preparing__';
  const lastSendError = agent.hydrateError?.message ?? agent.snapshot.error?.message ?? null;
  const activeBackendRunId = agent.activeRunId;
  const sessionRunStatusByKey = useMemo(
    () =>
      buildNcpSessionRunStatusByKey({
        summaries: sessionSummaries,
        activeSessionId,
        isLocallyRunning: isSending || Boolean(activeBackendRunId)
      }),
    [activeBackendRunId, activeSessionId, isSending, sessionSummaries]
  );

  useEffect(() => {
    if (!isSending && !activeBackendRunId) {
      return;
    }
    void refetchSessions();
  }, [activeBackendRunId, isSending, refetchSessions]);

  useEffect(() => {
    presenter.chatStreamActionsManager.bind({
      sendMessage: async (payload) => {
        if (payload.sessionKey !== activeSessionId) {
          return;
        }
        const metadata = buildNcpSendMetadata({
          model: payload.model,
          thinkingLevel: payload.thinkingLevel,
          sessionType: payload.sessionType,
          requestedSkills: payload.requestedSkills
        });
        const envelope = buildNcpRequestEnvelope({
          sessionId: payload.sessionKey,
          text: payload.message,
          attachments: payload.attachments,
          parts: payload.parts,
          metadata
        });
        if (!envelope) {
          return;
        }
        try {
          void sessionsQuery.refetch();
          await agent.send(envelope);
          await sessionsQuery.refetch();
        } catch (error) {
          if (payload.restoreDraftOnError) {
            if (payload.composerNodes && payload.composerNodes.length > 0) {
              presenter.chatInputManager.restoreComposerState?.(
                payload.composerNodes,
                payload.attachments ?? []
              );
            } else {
              presenter.chatInputManager.setDraft((currentDraft) =>
                currentDraft.trim().length === 0 ? payload.message : currentDraft
              );
            }
          }
          throw error;
        }
      },
      stopCurrentRun: async () => {
        await agent.abort();
        await sessionsQuery.refetch();
      },
      resumeRun: async (run: ChatRunView) => {
        if (run.sessionKey !== activeSessionId) {
          return;
        }
        await agent.streamRun();
      },
      resetStreamState: () => {
        selectedSessionKeyRef.current = null;
      },
      applyHistoryMessages: () => {}
    });
  }, [activeSessionId, agent, presenter, sessionsQuery]);

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
    presenter.chatInputManager.syncSnapshot({
      isProviderStateResolved,
      defaultSessionType,
      canStopGeneration: canStopCurrentRun,
      stopDisabledReason,
      stopSupported: true,
      stopReason: undefined,
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
      sessionTypeLabel: currentSessionTypeLabel,
      selectedSessionKey,
      sessionDisplayName: currentSessionDisplayName,
      canDeleteSession: Boolean(selectedSession),
      threadRef,
      isHistoryLoading: agent.isHydrating,
      uiMessages,
      isSending,
      isAwaitingAssistantOutput
    });
  }, [
    activeBackendRunId,
    agent.isHydrating,
    canEditSessionType,
    canStopCurrentRun,
    currentSessionDisplayName,
    currentSessionTypeLabel,
    defaultSessionType,
    installedSkillsQuery.isLoading,
    isAwaitingAssistantOutput,
    isProviderStateResolved,
    isSending,
    lastSendError,
    modelOptions.length,
    modelOptions,
    presenter,
    query,
    selectedSession,
    selectedSessionKey,
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
