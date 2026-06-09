import { useEffect, useMemo } from 'react';
import type {
  NcpSessionSummaryView,
  SessionEntryView,
  SessionSkillEntryView
} from '@/shared/lib/api';
import { sessionDisplayName } from '@/features/chat/utils/chat-session-display.utils';
import { adaptNcpSessionSummary } from '@/features/chat/utils/ncp-session-adapter.utils';
import type { NcpChatPresenter } from '@/features/chat/managers/ncp-chat-presenter.manager';
import type { UseHydratedNcpAgentResult } from '@nextclaw/ncp-react';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import type { ChatChildSessionTab } from '@/features/chat/stores/chat-thread.store';
import type { ChatSessionTypeOption } from '@/features/chat/hooks/use-chat-session-type-state';
import { resolveSessionTypeLabel } from '@/features/chat/hooks/use-chat-session-type-state';
import { readNcpContextWindowValue } from '@/features/chat/utils/ncp-session-context-metadata.utils';

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
  parentSessionId: string | null;
  sessionSummaries: NcpSessionSummaryView[];
  selectedSessionType: string;
  sessionTypeOptions: ChatSessionTypeOption[];
}) {
  const {
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
  sessionKey: string | null | undefined;
  currentAgentId: string;
  currentSessionDisplayName?: string;
  effectiveSessionProjectRoot: string | null;
  effectiveSessionWorkingDir: string | null;
  effectiveSessionProjectName: string | null;
  selectedSession: SessionEntryView | null;
  agent: Pick<UseHydratedNcpAgentResult, 'isHydrating' | 'snapshot' | 'visibleMessages'>;
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
      sessionKey: params.sessionKey ?? null,
      agentId: params.currentAgentId,
      sessionDisplayName: params.currentSessionDisplayName,
      sessionProjectRoot: params.effectiveSessionProjectRoot,
      sessionWorkingDir: params.effectiveSessionWorkingDir,
      sessionProjectName: params.effectiveSessionProjectName,
      canDeleteSession: Boolean(params.selectedSession),
      isHistoryLoading: params.agent.isHydrating,
      messages: params.agent.visibleMessages,
      isSending: params.isSending,
      isAwaitingAssistantOutput: params.isAwaitingAssistantOutput,
      contextWindow: readNcpContextWindowValue(params.agent.snapshot.contextWindow),
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
