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
import { ChatPageLayout, type ChatPageProps, useChatSessionSync } from '@/components/chat/chat-page-shell';
import { sessionDisplayName } from '@/components/chat/chat-session-display';
import { createNcpAppClientFetch } from '@/components/chat/ncp/ncp-app-client-fetch';
import { parseSessionKeyFromRoute, resolveAgentIdFromSessionKey } from '@/components/chat/chat-session-route';
import { useNcpChatPageData } from '@/components/chat/ncp/ncp-chat-page-data';
import { NcpChatPresenter } from '@/components/chat/ncp/ncp-chat.presenter';
import { createNcpSessionId } from '@/components/chat/ncp/ncp-session-adapter';
import { ChatPresenterProvider } from '@/components/chat/presenter/chat-presenter-context';
import type { ResumeRunParams } from '@/components/chat/chat-stream/types';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { resolveSessionTypeLabel } from '@/components/chat/useChatSessionTypeState';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { normalizeRequestedSkills } from '@/lib/chat-runtime-utils';
import { appClient } from '@/transport';

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
  const sessionStreamAttachInFlightRef = useRef(false);
  const routeSessionKey = useMemo(
    () => parseSessionKeyFromRoute(routeSessionIdParam),
    [routeSessionIdParam]
  );
  const {
    installedSkillsQuery,
    isProviderStateResolved,
    modelOptions,
    sessionSummaries,
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

  const isSending = agent.isSending || agent.isRunning;
  const isAwaitingAssistantOutput = agent.isRunning;
  const canStopCurrentRun = agent.isRunning;
  const stopDisabledReason = agent.isRunning ? null : '__preparing__';
  const lastSendError = agent.hydrateError?.message ?? agent.snapshot.error?.message ?? null;

  useEffect(() => {
    const attachRealtimeSessionStream = () => {
      if (sessionStreamAttachInFlightRef.current) {
        return;
      }
      if (agent.isHydrating || agent.isRunning || agent.isSending) {
        return;
      }

      sessionStreamAttachInFlightRef.current = true;
      void ncpClient
        .stream({ sessionId: activeSessionId })
        .catch(() => undefined)
        .finally(() => {
          sessionStreamAttachInFlightRef.current = false;
        });
    };

    return appClient.subscribe((event) => {
      if (
        event.type === 'session.run-status' &&
        event.payload.sessionKey === activeSessionId &&
        event.payload.status === 'running'
      ) {
        attachRealtimeSessionStream();
      }
    });
  }, [activeSessionId, agent.isHydrating, agent.isRunning, agent.isSending, ncpClient]);

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
          await agent.send(envelope);
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
      },
      resumeRun: async (run: ResumeRunParams) => {
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
  }, [activeSessionId, agent, presenter]);

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
      messages: agent.visibleMessages,
      isSending,
      isAwaitingAssistantOutput
    });
  }, [
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
    selectedSession,
    selectedSessionKey,
    selectedSessionType,
    sessionTypeOptions,
    sessionTypeUnavailable,
    sessionTypeUnavailableMessage,
    skillRecords,
    stopDisabledReason,
    threadRef,
    agent.visibleMessages
  ]);

  return (
    <ChatPresenterProvider presenter={presenter}>
      <ChatPageLayout view={view} confirmDialog={<ConfirmDialog />} />
    </ChatPresenterProvider>
  );
}
