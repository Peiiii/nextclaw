import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildNcpRequestEnvelope,
} from "@nextclaw/ncp-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChatPageLayout, type ChatPageProps, useChatSessionSync } from "@/components/chat/chat-page-shell";
import { buildInlineSkillTokensFromComposer, CHAT_UI_INLINE_TOKENS_METADATA_KEY } from "@/features/chat/utils/chat-inline-token.utils";
import { parseSessionKeyFromRoute } from "@/features/chat/utils/chat-session-route.utils";
import { useNcpChatPageData } from "@/features/chat/hooks/use-ncp-chat-page-data";
import { NcpChatPresenter } from "@/features/chat/managers/ncp-chat-presenter.manager";
import {
  isNcpAgentStartupUnavailableErrorMessage,
  useNcpSessionConversation,
} from "@/features/chat/hooks/runtime/use-ncp-session-conversation";
import {
  useNcpChatDerivedState,
  useNcpChatSnapshotSync,
} from "@/features/chat/hooks/use-ncp-chat-derived-state";
import { ChatPresenterProvider } from "@/features/chat/components/providers/chat-presenter.provider";
import type { ResumeRunParams } from "@/features/chat/types/chat-stream.types";
import { useChatInputStore } from "@/features/chat/stores/chat-input.store";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useAgents } from "@/hooks/agents/useAgents";
import { normalizeRequestedSkills } from "@/lib/chat-runtime-utils";
import {
  systemStatusManager,
  useChatRuntimeAvailability,
} from "@/features/system-status";
import {
  getSessionProjectName,
  normalizeSessionProjectRootValue,
} from "@/lib/session-project/session-project.utils";

export function buildNcpSendMetadata(payload: {
  agentId?: string;
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
    metadata.runtime = payload.sessionType.trim();
  }
  if (payload.agentId?.trim()) {
    metadata.agent_id = payload.agentId.trim();
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

export function shouldClearPendingProjectRootOverride(params: {
  pendingProjectRoot: string | null;
  pendingProjectRootSessionKey: string | null;
  sessionKey: string | null | undefined;
  selectedSessionProjectRoot: string | null | undefined;
}): boolean {
  const {
    pendingProjectRoot,
    pendingProjectRootSessionKey,
    sessionKey,
    selectedSessionProjectRoot,
  } = params;
  return (
    pendingProjectRoot !== null &&
    pendingProjectRootSessionKey !== null &&
    sessionKey === pendingProjectRootSessionKey &&
    (selectedSessionProjectRoot ?? null) === pendingProjectRoot
  );
}

function useNcpChatPageBaseState(presenter: NcpChatPresenter) {
  const query = useChatSessionListStore((state) => state.snapshot.query);
  const selectedSessionKey = useChatSessionListStore(
    (state) => state.snapshot.selectedSessionKey,
  );
  const draftSessionKey = useChatSessionListStore(
    (state) => state.snapshot.draftSessionKey,
  );
  const selectedAgentId = useChatSessionListStore(
    (state) => state.snapshot.selectedAgentId,
  );
  const pendingSessionType = useChatInputStore(
    (state) => state.snapshot.pendingSessionType,
  );
  const pendingProjectRoot = useChatInputStore(
    (state) => state.snapshot.pendingProjectRoot,
  );
  const pendingProjectRootSessionKey = useChatInputStore(
    (state) => state.snapshot.pendingProjectRootSessionKey,
  );
  const currentSelectedModel = useChatInputStore(
    (state) => state.snapshot.selectedModel,
  );
  const runtimeAvailability = useChatRuntimeAvailability();
  const agentsQuery = useAgents();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId: routeSessionIdParam } = useParams<{ sessionId?: string }>();
  const threadRef = useRef<HTMLDivElement | null>(null);
  const selectedSessionKeyRef = useRef<string | null>(selectedSessionKey);
  const routeSessionKey = useMemo(
    () => parseSessionKeyFromRoute(routeSessionIdParam),
    [routeSessionIdParam],
  );
  const sessionKey = routeSessionKey ?? selectedSessionKey ?? draftSessionKey;
  const hasSessionProjectRootOverride =
    pendingProjectRoot !== null &&
    pendingProjectRootSessionKey === sessionKey;
  const sessionProjectRootOverride = hasSessionProjectRootOverride
    ? pendingProjectRoot
    : undefined;
  const pageData = useNcpChatPageData({
    query,
    sessionKey,
    projectRootOverride: sessionProjectRootOverride,
    currentSelectedModel,
    pendingSessionType,
    setPendingSessionType: presenter.chatInputManager.setPendingSessionType,
    setSelectedModel: presenter.chatInputManager.setSelectedModel,
    setSelectedThinkingLevel:
      presenter.chatInputManager.setSelectedThinkingLevel,
  });
  const agent = useNcpSessionConversation(sessionKey);
  return {
    presenter,
    selectedSessionKey,
    selectedAgentId,
    pendingProjectRoot,
    pendingProjectRootSessionKey,
    runtimeAvailability,
    agentsQuery,
    confirm,
    ConfirmDialog,
    location,
    navigate,
    threadRef,
    selectedSessionKeyRef,
    routeSessionKey,
    sessionKey,
    hasSessionProjectRootOverride,
    agent,
    ...pageData,
  };
}

function useNcpChatPageState(presenter: NcpChatPresenter) {
  const baseState = useNcpChatPageBaseState(presenter);
  const {
    agent,
    agentsQuery,
    hasSessionProjectRootOverride,
    pendingProjectRoot,
    runtimeAvailability,
    selectedAgentId,
    selectedSession,
    selectedSessionType,
    sessionKey,
    sessionSummaries,
    sessionTypeOptions,
  } = baseState;
  const effectiveSessionProjectRoot = hasSessionProjectRootOverride
    ? pendingProjectRoot
    : (selectedSession?.projectRoot ?? null);
  const effectiveSessionProjectName = hasSessionProjectRootOverride
    ? getSessionProjectName(effectiveSessionProjectRoot)
    : (selectedSession?.projectName ??
      getSessionProjectName(effectiveSessionProjectRoot));
  const rawLastSendError =
    agent.hydrateError?.message ?? agent.snapshot.error?.message ?? null;
  const filteredLastSendError =
    runtimeAvailability.phase === "ready" &&
    isNcpAgentStartupUnavailableErrorMessage(rawLastSendError)
      ? null
      : rawLastSendError;
  const availableAgents = (agentsQuery.data?.agents?.length ?? 0) > 0
    ? (agentsQuery.data?.agents ?? [])
    : [{ id: selectedSession?.agentId ?? selectedAgentId }];
  const derivedState = useNcpChatDerivedState({
    sessionKey,
    selectedSession,
    selectedAgentId,
    availableAgents,
    parentSessionId: selectedSession?.parentSessionId ?? null,
    sessionSummaries,
    selectedSessionType,
    sessionTypeOptions,
  });
  return {
    ...baseState,
    availableAgents,
    effectiveSessionProjectRoot,
    effectiveSessionProjectName,
    isSending: agent.isSending || agent.isRunning,
    isAwaitingAssistantOutput: agent.isRunning,
    canStopCurrentRun: agent.isRunning,
    stopDisabledReason: agent.isRunning ? null : "__preparing__",
    lastSendError:
      runtimeAvailability.isBlocked
        ? null
        : runtimeAvailability.phase === "ready"
        ? filteredLastSendError
        : systemStatusManager.getDisplayMessage(filteredLastSendError),
    ...derivedState,
  };
}

function useNcpChatStreamBindings(params: ReturnType<typeof useNcpChatPageState>) {
  const {
    agent,
    pendingProjectRoot,
    pendingProjectRootSessionKey,
    presenter,
    selectedSession,
    selectedSessionKey,
    selectedSessionKeyRef,
    sessionKey,
  } = params;
  useEffect(() => {
    presenter.chatStreamActionsManager.bind({
      sendMessage: async (payload) => {
        if (payload.sessionKey !== sessionKey) {
          return;
        }
        const metadata = buildNcpSendMetadata({
          agentId: payload.agentId,
          model: payload.model,
          thinkingLevel: payload.thinkingLevel,
          sessionType: payload.sessionType,
          projectRoot:
            payload.sessionKey === pendingProjectRootSessionKey
              ? pendingProjectRoot
              : (selectedSession?.projectRoot ?? null),
          requestedSkills: payload.requestedSkills,
          composerNodes: payload.composerNodes,
        });
        const envelope = buildNcpRequestEnvelope({
          sessionId: payload.sessionKey,
          text: payload.message,
          attachments: payload.attachments,
          parts: payload.parts,
          metadata,
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
                payload.attachments ?? [],
              );
            } else {
              presenter.chatInputManager.setDraft((currentDraft) =>
                currentDraft.trim().length === 0
                  ? payload.message
                  : currentDraft,
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
      applyHistoryMessages: () => {},
    });
  }, [
    agent,
    pendingProjectRoot,
    pendingProjectRootSessionKey,
    presenter,
    selectedSessionKey,
    selectedSession?.projectRoot,
    selectedSessionKeyRef,
    sessionKey,
  ]);
}

function usePendingProjectRootOverrideCleanup(
  params: ReturnType<typeof useNcpChatPageState>,
) {
  const {
    pendingProjectRoot,
    pendingProjectRootSessionKey,
    selectedSession,
    selectedSessionKey,
  } = params;
  useEffect(() => {
    if (
      !selectedSession ||
      !shouldClearPendingProjectRootOverride({
        pendingProjectRoot,
        pendingProjectRootSessionKey,
        sessionKey: selectedSession.key,
        selectedSessionProjectRoot: selectedSession.projectRoot ?? null,
      })
    ) {
      return;
    }
    useChatInputStore.getState().setSnapshot({
      pendingProjectRoot: null,
      pendingProjectRootSessionKey: null,
    });
  }, [
    pendingProjectRoot,
    pendingProjectRootSessionKey,
    selectedSession,
    selectedSessionKey,
  ]);
}

function useNcpChatUiBindings(params: ReturnType<typeof useNcpChatPageState>) {
  const { confirm, location, navigate, presenter } = params;
  useEffect(() => {
    presenter.chatUiManager.syncState({
      pathname: location.pathname,
    });
    presenter.chatUiManager.bindActions({
      navigate,
      confirm,
    });
  }, [confirm, location.pathname, navigate, presenter]);
}

function useSelectedSessionAgentSync(params: ReturnType<typeof useNcpChatPageState>) {
  const { presenter, selectedAgentId, selectedSession } = params;
  useEffect(() => {
    if (!selectedSession?.agentId || selectedAgentId === selectedSession.agentId) {
      return;
    }
    presenter.chatSessionListManager.setSelectedAgentId(selectedSession.agentId);
  }, [presenter, selectedAgentId, selectedSession?.agentId]);
}

export function NcpChatPage({ view }: ChatPageProps) {
  const [presenter] = useState(() => new NcpChatPresenter());
  const state = useNcpChatPageState(presenter);
  useNcpChatStreamBindings(state);
  usePendingProjectRootOverrideCleanup(state);
  useNcpChatUiBindings(state);
  useSelectedSessionAgentSync(state);
  useChatSessionSync({
    view,
    routeSessionKey: state.routeSessionKey,
    selectedSessionKey: state.selectedSessionKey,
    setSelectedSessionKey: presenter.chatSessionListManager.setSelectedSessionKey,
    selectedSessionKeyRef: state.selectedSessionKeyRef,
    resetStreamState: presenter.chatStreamActionsManager.resetStreamState,
  });
  useNcpChatSnapshotSync({
    presenter,
    isProviderStateResolved: state.isProviderStateResolved,
    defaultSessionType: state.defaultSessionType,
    canStopCurrentRun: state.canStopCurrentRun,
    stopDisabledReason: state.stopDisabledReason,
    lastSendError: state.lastSendError,
    isSending: state.isSending,
    modelOptions: state.modelOptions,
    sessionTypeOptions: state.sessionTypeOptions,
    selectedSessionType: state.selectedSessionType,
    canEditSessionType: state.canEditSessionType,
    sessionTypeUnavailable: state.sessionTypeUnavailable,
    skillRecords: state.skillRecords,
    isSkillsLoading: state.sessionSkillsQuery.isLoading,
    sessionTypeUnavailableMessage: state.sessionTypeUnavailableMessage,
    currentSessionTypeLabel: state.currentSessionTypeLabel,
    currentSessionTypeIcon: state.currentSessionTypeIcon,
    sessionKey: state.sessionKey,
    currentAgentId: state.currentAgentId,
    currentAgent: state.currentAgent,
    availableAgents: state.availableAgents,
    currentSessionDisplayName: state.currentSessionDisplayName,
    effectiveSessionProjectRoot: state.effectiveSessionProjectRoot,
    effectiveSessionProjectName: state.effectiveSessionProjectName,
    selectedSession: state.selectedSession,
    threadRef: state.threadRef,
    agent: state.agent,
    isAwaitingAssistantOutput: state.isAwaitingAssistantOutput,
    parentSession: state.parentSession,
    childSessionTabs: state.currentChildSessionTabs,
  });
  return (
    <ChatPresenterProvider presenter={presenter}>
      <ChatPageLayout view={view} confirmDialog={<state.ConfirmDialog />} />
    </ChatPresenterProvider>
  );
}
