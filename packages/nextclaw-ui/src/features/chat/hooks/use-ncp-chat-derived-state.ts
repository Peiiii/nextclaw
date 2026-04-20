import { useEffect, useMemo, type MutableRefObject } from 'react';
import type {
  AgentProfileView,
  NcpSessionSummaryView,
  SessionEntryView,
  SessionSkillEntryView
} from '@/api/types';
import { sessionDisplayName } from '@/features/chat/utils/chat-session-display.utils';
import { adaptNcpSessionSummary } from '@/features/chat/utils/ncp-session-adapter.utils';
import type { NcpChatPresenter } from '@/features/chat/managers/ncp-chat-presenter.manager';
import type { UseHydratedNcpAgentResult } from '@nextclaw/ncp-react';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import type { ChatChildSessionTab } from '@/features/chat/stores/chat-thread.store';
import type { ChatSessionTypeOption } from '@/features/chat/hooks/use-chat-session-type-state';
import { resolveSessionTypeLabel } from '@/features/chat/hooks/use-chat-session-type-state';

function buildChildSessionTabs(params: {
  parentSessionKey: string | null;
  sessionSummaries: NcpSessionSummaryView[];
}): ChatChildSessionTab[] {
  if (!params.parentSessionKey) {
    return [];
  }
  return params.sessionSummaries
    .map(adaptNcpSessionSummary)
    .filter((session) => session.parentSessionId === params.parentSessionKey)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((session) => ({
      sessionKey: session.key,
      parentSessionKey: session.parentSessionId ?? null,
      label: session.label ?? null,
      agentId: session.agentId ?? null,
    }));
}

export function useNcpChatDerivedState(params: {
  sessionKey: string | null;
  selectedSession: SessionEntryView | null;
  selectedAgentId: string;
  availableAgents: AgentProfileView[];
  parentSessionId: string | null;
  sessionSummaries: NcpSessionSummaryView[];
  selectedSessionType: string;
  sessionTypeOptions: ChatSessionTypeOption[];
}) {
  const {
    availableAgents,
    parentSessionId,
    selectedAgentId,
    selectedSession,
    selectedSessionType,
    sessionKey,
    sessionSummaries,
    sessionTypeOptions,
  } = params;
  const currentSessionDisplayName = selectedSession
    ? sessionDisplayName(selectedSession)
    : undefined;
  const currentAgentId = selectedSession?.agentId ?? selectedAgentId;
  const currentAgent =
    availableAgents.find((agent) => agent.id === currentAgentId) ?? null;
  const parentSession = useMemo(() => {
    if (!parentSessionId) {
      return null;
    }
    const parentSummary =
      sessionSummaries.find(
        (summary) => summary.sessionId === parentSessionId,
      ) ?? null;
    return parentSummary ? adaptNcpSessionSummary(parentSummary) : null;
  }, [parentSessionId, sessionSummaries]);
  const currentSessionTypeOption =
    sessionTypeOptions.find((option) => option.value === selectedSessionType) ?? null;
  const currentSessionTypeLabel =
    currentSessionTypeOption?.label ?? resolveSessionTypeLabel(selectedSessionType);
  const currentSessionTypeIcon = currentSessionTypeOption?.icon ?? null;
  const currentChildSessionTabs = useMemo(
    () =>
      buildChildSessionTabs({
        parentSessionKey: sessionKey,
        sessionSummaries,
      }),
    [sessionKey, sessionSummaries],
  );

  return {
    currentSessionDisplayName,
    currentAgentId,
    currentAgent,
    parentSession,
    currentSessionTypeLabel,
    currentSessionTypeIcon,
    currentChildSessionTabs,
  };
}

export function useNcpChatSnapshotSync(params: {
  presenter: NcpChatPresenter;
  isProviderStateResolved: boolean;
  defaultSessionType: string;
  canStopCurrentRun: boolean;
  stopDisabledReason: string | null;
  lastSendError: string | null;
  isSending: boolean;
  modelOptions: ChatModelOption[];
  sessionTypeOptions: ChatSessionTypeOption[];
  selectedSessionType: string;
  canEditSessionType: boolean;
  sessionTypeUnavailable: boolean;
  skillRecords: SessionSkillEntryView[];
  isSkillsLoading: boolean;
  sessionTypeUnavailableMessage: string | null;
  currentSessionTypeLabel: string;
  currentSessionTypeIcon: ChatSessionTypeOption['icon'];
  sessionKey: string;
  currentAgentId: string;
  currentAgent: AgentProfileView | null;
  availableAgents: AgentProfileView[];
  currentSessionDisplayName?: string;
  effectiveSessionProjectRoot: string | null;
  effectiveSessionProjectName: string | null;
  selectedSession: SessionEntryView | null;
  threadRef: MutableRefObject<HTMLDivElement | null>;
  agent: Pick<UseHydratedNcpAgentResult, 'isHydrating' | 'visibleMessages'>;
  isAwaitingAssistantOutput: boolean;
  parentSession: SessionEntryView | null;
  childSessionTabs: ChatChildSessionTab[];
}) {
  useEffect(() => {
    params.presenter.chatInputManager.syncSnapshot({
      isProviderStateResolved: params.isProviderStateResolved,
      defaultSessionType: params.defaultSessionType,
      canStopGeneration: params.canStopCurrentRun,
      stopDisabledReason: params.stopDisabledReason,
      stopSupported: true,
      stopReason: undefined,
      sendError: params.lastSendError,
      isSending: params.isSending,
      modelOptions: params.modelOptions,
      sessionTypeOptions: params.sessionTypeOptions,
      selectedSessionType: params.selectedSessionType,
      canEditSessionType: params.canEditSessionType,
      sessionTypeUnavailable: params.sessionTypeUnavailable,
      skillRecords: params.skillRecords,
      isSkillsLoading: params.isSkillsLoading,
    });
    params.presenter.chatThreadManager.syncSnapshot({
      isProviderStateResolved: params.isProviderStateResolved,
      modelOptions: params.modelOptions,
      sessionTypeUnavailable: params.sessionTypeUnavailable,
      sessionTypeUnavailableMessage: params.sessionTypeUnavailableMessage,
      sessionTypeLabel: params.currentSessionTypeLabel,
      sessionTypeIcon: params.currentSessionTypeIcon,
      sessionKey: params.sessionKey,
      agentId: params.currentAgentId,
      agentDisplayName: params.currentAgent?.displayName ?? null,
      agentAvatarUrl: params.currentAgent?.avatarUrl ?? null,
      availableAgents: params.availableAgents,
      sessionDisplayName: params.currentSessionDisplayName,
      sessionProjectRoot: params.effectiveSessionProjectRoot,
      sessionProjectName: params.effectiveSessionProjectName,
      canDeleteSession: Boolean(params.selectedSession),
      threadRef: params.threadRef,
      isHistoryLoading: params.agent.isHydrating,
      messages: params.agent.visibleMessages,
      isSending: params.isSending,
      isAwaitingAssistantOutput: params.isAwaitingAssistantOutput,
      parentSessionKey: params.parentSession?.key ?? null,
      parentSessionLabel: params.parentSession
        ? sessionDisplayName(params.parentSession)
        : null,
      childSessionTabs: params.childSessionTabs,
    });
  }, [
    params
  ]);
}
