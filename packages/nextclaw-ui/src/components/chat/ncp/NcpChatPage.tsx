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
import { buildInlineSkillTokensFromComposer, CHAT_UI_INLINE_TOKENS_METADATA_KEY } from '@/components/chat/chat-inline-token.utils';
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
import { getSessionProjectName, normalizeSessionProjectRootValue } from '@/lib/session-project/session-project.utils';
import { appClient } from '@/transport';

export function buildNcpSendMetadata(payload: {
  model?: string;
  thinkingLevel?: string;
  sessionType?: string;
  projectRoot?: string | null;
  requestedSkills?: string[];
  composerNodes?: Parameters<typeof buildInlineSkillTokensFromComposer>[0];
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
  const projectRoot = normalizeSessionProjectRootValue(payload.projectRoot);
  if (projectRoot) {
    metadata.project_root = projectRoot;
  }
  const requestedSkills = normalizeRequestedSkills(payload.requestedSkills);
  if (requestedSkills.length > 0) {
    metadata.requested_skill_refs = requestedSkills;
  }
  const inlineSkillTokens = payload.composerNodes
    ? buildInlineSkillTokensFromComposer(payload.composerNodes)
    : [];
  if (inlineSkillTokens.length > 0) {
    metadata[CHAT_UI_INLINE_TOKENS_METADATA_KEY] = inlineSkillTokens;
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
  const pendingProjectRoot = useChatInputStore((state) => state.snapshot.pendingProjectRoot);
  const pendingProjectRootSessionKey = useChatInputStore((state) => state.snapshot.pendingProjectRootSessionKey);
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
  const sessionKey = selectedSessionKey ?? draftSessionId;
  const hasSessionProjectRootOverride = pendingProjectRootSessionKey === sessionKey;
  const sessionProjectRootOverride = hasSessionProjectRootOverride ? pendingProjectRoot : undefined;
  const {
    sessionSkillsQuery,
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
    sessionKey,
    projectRootOverride: sessionProjectRootOverride,
    currentSelectedModel,
    pendingSessionType,
    setPendingSessionType: presenter.chatInputManager.setPendingSessionType,
    setSelectedModel: presenter.chatInputManager.setSelectedModel,
    setSelectedThinkingLevel: presenter.chatInputManager.setSelectedThinkingLevel
  });

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
    sessionId: sessionKey,
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

  const effectiveSessionProjectRoot = hasSessionProjectRootOverride ? pendingProjectRoot : selectedSession?.projectRoot ?? null;
  const effectiveSessionProjectName = hasSessionProjectRootOverride ? getSessionProjectName(effectiveSessionProjectRoot) : selectedSession?.projectName ?? getSessionProjectName(effectiveSessionProjectRoot);

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
        .stream({ sessionId: sessionKey })
        .catch(() => undefined)
        .finally(() => {
          sessionStreamAttachInFlightRef.current = false;
        });
    };

    return appClient.subscribe((event) => {
      if (
        event.type === 'session.run-status' &&
        event.payload.sessionKey === sessionKey &&
        event.payload.status === 'running'
      ) {
        attachRealtimeSessionStream();
      }
    });
  }, [agent.isHydrating, agent.isRunning, agent.isSending, ncpClient, sessionKey]);

  useEffect(() => {
    presenter.chatStreamActionsManager.bind({
      sendMessage: async (payload) => {
        if (payload.sessionKey !== sessionKey) {
          return;
        }
        const metadata = buildNcpSendMetadata({
          model: payload.model,
          thinkingLevel: payload.thinkingLevel,
          sessionType: payload.sessionType,
          projectRoot:
            payload.sessionKey === pendingProjectRootSessionKey
              ? pendingProjectRoot
              : selectedSession?.projectRoot ?? null,
          requestedSkills: payload.requestedSkills,
          composerNodes: payload.composerNodes
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
        if (run.sessionKey !== sessionKey) {
          return;
        }
        await agent.streamRun();
      },
      resetStreamState: () => {
        selectedSessionKeyRef.current = null;
      },
      applyHistoryMessages: () => {}
    });
  }, [
    agent,
    pendingProjectRoot,
    pendingProjectRootSessionKey,
    presenter,
    selectedSession?.projectRoot,
    sessionKey
  ]);

  useEffect(() => {
    if (!selectedSession || pendingProjectRootSessionKey !== selectedSession.key || (selectedSession.projectRoot ?? null) !== pendingProjectRoot) {
      return;
    }
    useChatInputStore.getState().setSnapshot({
      pendingProjectRoot: null,
      pendingProjectRootSessionKey: null
    });
  }, [pendingProjectRoot, pendingProjectRootSessionKey, selectedSession]);

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
      isSkillsLoading: sessionSkillsQuery.isLoading
    });
    presenter.chatThreadManager.syncSnapshot({
      isProviderStateResolved,
      modelOptions,
      sessionTypeUnavailable,
      sessionTypeUnavailableMessage,
      sessionTypeLabel: currentSessionTypeLabel,
      sessionKey,
      sessionDisplayName: currentSessionDisplayName,
      sessionProjectRoot: effectiveSessionProjectRoot,
      sessionProjectName: effectiveSessionProjectName,
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
    sessionSkillsQuery.isLoading,
    isAwaitingAssistantOutput,
    isProviderStateResolved,
    isSending,
    lastSendError,
    modelOptions,
    presenter,
    effectiveSessionProjectName,
    effectiveSessionProjectRoot,
    selectedSession,
    sessionKey,
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
