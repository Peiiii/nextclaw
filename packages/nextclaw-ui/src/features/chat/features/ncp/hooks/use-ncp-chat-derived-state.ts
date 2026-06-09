import { useEffect, useMemo } from 'react';
import type {
  NcpSessionSummaryView,
  SessionEntryView,
  SessionSkillEntryView,
} from '@/shared/lib/api';
import { sessionDisplayName } from '@/features/chat/features/session/utils/chat-session-display.utils';
import { adaptNcpSessionSummary } from '@/features/chat/features/session/utils/ncp-session-adapter.utils';
import type { NcpChatPresenter } from '@/features/chat/managers/ncp-chat-presenter.manager';
import type { UseHydratedNcpAgentResult } from '@nextclaw/ncp-react';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import type { ChatChildSessionTab } from '@/features/chat/stores/chat-thread.store';
import type { ChatSessionTypeOption } from '@/features/chat/features/session-type/utils/chat-session-type.utils';
import { resolveSessionTypeLabel } from '@/features/chat/features/session-type/utils/chat-session-type.utils';
import { readNcpContextWindowValue } from '@/features/chat/features/session/utils/ncp-session-context-metadata.utils';
import { getSessionProjectName } from '@/shared/lib/session-project';

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

function resolveCurrentSessionTypeView(params: {
  selectedSessionType: string;
  sessionTypeOptions: ChatSessionTypeOption[];
}): {
  label: string;
  icon: ChatSessionTypeOption['icon'];
} {
  const option =
    params.sessionTypeOptions.find(
      (sessionTypeOption) =>
        sessionTypeOption.value === params.selectedSessionType,
    ) ?? null;
  return {
    label: option?.label ?? resolveSessionTypeLabel(params.selectedSessionType),
    icon: option?.icon ?? null,
  };
}

export function useNcpChatDerivedState(params: {
  sessionKey: string | null;
  selectedSession: SessionEntryView | null;
  sessionSummaries: NcpSessionSummaryView[];
}) {
  const {
    selectedSession,
    sessionKey,
    sessionSummaries,
  } = params;
  const parentSessionId = selectedSession?.parentSessionId ?? null;
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
  const currentChildSessionTabs = useMemo(
    () =>
      buildChildSessionTabs({
        parentSessionKey: sessionKey,
        sessionSummaries,
      }),
    [sessionKey, sessionSummaries],
  );

  return {
    parentSession,
    currentChildSessionTabs,
  };
}

export function useNcpChatSnapshotSync(params: {
  presenter: NcpChatPresenter;
  isProviderStateResolved: boolean;
  defaultSessionType: string;
  canStopCurrentRun: boolean;
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
  fallbackPreferredModel?: string;
  defaultModel?: string;
  sessionKey: string | null | undefined;
  selectedSession: SessionEntryView | null;
  agent: Pick<UseHydratedNcpAgentResult, 'isHydrating' | 'snapshot' | 'visibleMessages'>;
  parentSession: SessionEntryView | null;
  childSessionTabs: ChatChildSessionTab[];
}) {
  useEffect(() => {
    const currentSessionType = resolveCurrentSessionTypeView({
      selectedSessionType: params.selectedSessionType,
      sessionTypeOptions: params.sessionTypeOptions,
    });
    params.presenter.chatInputManager.syncSnapshot({
      isProviderStateResolved: params.isProviderStateResolved,
      defaultSessionType: params.defaultSessionType,
      canStopGeneration: params.canStopCurrentRun,
      stopDisabledReason: params.canStopCurrentRun ? null : '__preparing__',
      stopSupported: true,
      stopReason: undefined,
      sendError: params.lastSendError,
      isSending: params.isSending,
      modelOptions: params.modelOptions,
      sessionTypeOptions: params.sessionTypeOptions,
      canEditSessionType: params.canEditSessionType,
      sessionTypeUnavailable: params.sessionTypeUnavailable,
      sessionTypeUnavailableMessage: params.sessionTypeUnavailableMessage,
      skillRecords: params.skillRecords,
      isSkillsLoading: params.isSkillsLoading,
    });
    if (params.selectedSession) {
      params.presenter.chatInputManager.syncSnapshot({
        selectedSessionType: params.selectedSessionType,
      });
    }
    const sessionProjectRoot = params.selectedSession?.projectRoot ?? null;
    params.presenter.chatThreadManager.syncSnapshot({
      sessionTypeLabel: currentSessionType.label,
      sessionTypeIcon: currentSessionType.icon,
      sessionKey: params.sessionKey ?? null,
      agentId: params.selectedSession?.agentId ?? null,
      sessionDisplayName: params.selectedSession
        ? sessionDisplayName(params.selectedSession)
        : undefined,
      sessionProjectRoot,
      sessionWorkingDir: params.selectedSession?.workingDir ?? sessionProjectRoot,
      sessionProjectName:
        params.selectedSession?.projectName ??
        getSessionProjectName(sessionProjectRoot),
      canDeleteSession: Boolean(params.selectedSession),
      isHistoryLoading: params.agent.isHydrating,
      messages: params.agent.visibleMessages,
      isSending: params.isSending,
      isAwaitingAssistantOutput: params.canStopCurrentRun,
      contextWindow: readNcpContextWindowValue(params.agent.snapshot.contextWindow),
      parentSessionKey: params.parentSession?.key ?? null,
      parentSessionLabel: params.parentSession
        ? sessionDisplayName(params.parentSession)
        : null,
      childSessionTabs: params.childSessionTabs,
    });
    params.presenter.chatInputManager.syncSessionPreferences({
      selectedSessionExists: Boolean(params.selectedSession),
      selectedSessionPreferredModel: params.selectedSession?.preferredModel,
      fallbackPreferredModel: params.fallbackPreferredModel,
      defaultModel: params.defaultModel,
      selectedSessionPreferredThinking:
        params.selectedSession?.preferredThinking ?? null,
    });
    params.presenter.chatSessionListManager.syncSelectedSessionAgent();
    params.presenter.chatInputManager.clearPendingProjectRootOverrideForCurrentThread();
  }, [
    params
  ]);
}
