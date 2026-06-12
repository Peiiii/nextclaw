import { useMemo } from 'react';
import type { NcpSessionSummaryView, SessionSkillEntryView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import {
  buildNcpChatProviderModelOptions,
  filterNcpChatModelOptionsBySessionType,
} from '@/features/chat/features/ncp/utils/ncp-chat-query-derived.utils';
import { useNcpChatProviderStateResolved } from '@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state';
import { useChatSessionTypeState } from '@/features/chat/features/session-type/hooks/use-chat-session-type-state';
import { adaptNcpSessionSummaries } from '@/features/chat/features/session/utils/ncp-session-adapter.utils';
import { resolveRecentSessionPreferredValue } from '@/features/chat/features/session/utils/chat-session-preference-governance.utils';
import { chatRecentModelsManager } from '@/features/chat/managers/chat-recent-models.manager';
import type { ChatInputSnapshot } from '@/features/chat/stores/chat-input.store';
import { useChatQueryStore } from '@/features/chat/stores/ncp-chat-query.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';

const EMPTY_SESSION_SKILL_RECORDS: SessionSkillEntryView[] = [];
const EMPTY_NCP_SESSION_SUMMARIES: NcpSessionSummaryView[] = [];

export function useChatInputBarQueryState(snapshot: ChatInputSnapshot) {
  const presenter = usePresenter();
  const selectedSessionKey = useChatSessionListStore(
    (state) => state.snapshot.selectedSessionKey,
  );
  const isProviderStateResolved = useNcpChatProviderStateResolved();
  const querySnapshot = useChatQueryStore((state) => state.snapshot);
  const config = querySnapshot.configQuery?.data ?? null;
  const sessionSummaries =
    querySnapshot.sessionsQuery?.data?.sessions ?? EMPTY_NCP_SESSION_SUMMARIES;
  const skillRecords =
    querySnapshot.sessionSkillsQuery?.data?.records ?? EMPTY_SESSION_SKILL_RECORDS;
  const isSkillsLoading = Boolean(
    querySnapshot.sessionSkillsQuery?.isLoading ||
      querySnapshot.sessionSkillsQuery?.isFetching,
  );
  const sessions = useMemo(
    () => adaptNcpSessionSummaries(sessionSummaries),
    [sessionSummaries],
  );
  const selectedSession = useMemo(
    () => sessions.find((session) => session.key === selectedSessionKey) ?? null,
    [selectedSessionKey, sessions],
  );
  const sessionTypeState = useChatSessionTypeState({
    selectedSession,
    pendingSessionType: snapshot.pendingSessionType,
    setPendingSessionType: presenter.chatInputManager.setPendingSessionType,
    sessionTypesData: querySnapshot.sessionTypesQuery?.data ?? null,
  });
  const providerModelOptions = useMemo(
    () =>
      buildNcpChatProviderModelOptions({
        config,
        providersView: querySnapshot.providersQuery?.data ?? null,
        templatesView: querySnapshot.providerTemplatesQuery?.data ?? null,
      }),
    [config, querySnapshot.providerTemplatesQuery?.data, querySnapshot.providersQuery?.data],
  );
  const modelOptions = useMemo(
    () =>
      filterNcpChatModelOptionsBySessionType({
        modelOptions: providerModelOptions,
        modelSelectionMode: sessionTypeState.selectedSessionTypeOption?.modelSelectionMode,
        runtimeDefaultModelLabel: t('chatRuntimeDefaultModel'),
        supportedModels: sessionTypeState.selectedSessionTypeOption?.supportedModels,
      }),
    [
      providerModelOptions,
      sessionTypeState.selectedSessionTypeOption?.modelSelectionMode,
      sessionTypeState.selectedSessionTypeOption?.supportedModels,
    ],
  );
  const availableModelValueSet = useMemo(
    () => new Set(modelOptions.map((option) => option.value)),
    [modelOptions],
  );
  const recentSessionTypeModel = chatRecentModelsManager
    .read({ namespace: sessionTypeState.selectedSessionType })
    .find((value) => availableModelValueSet.has(value));
  const fallbackPreferredModel = useMemo(
    () =>
      recentSessionTypeModel ??
      resolveRecentSessionPreferredValue<string>({
        sessions,
        selectedSessionKey,
        sessionType: sessionTypeState.selectedSessionType,
        readPreference: (session) => session.preferredModel?.trim() || undefined,
      }),
    [recentSessionTypeModel, selectedSessionKey, sessionTypeState.selectedSessionType, sessions],
  );
  const fallbackPreferredThinking = useMemo(
    () =>
      resolveRecentSessionPreferredValue({
        sessions,
        selectedSessionKey,
        sessionType: sessionTypeState.selectedSessionType,
        readPreference: (session) => session.preferredThinking ?? undefined,
      }),
    [selectedSessionKey, sessionTypeState.selectedSessionType, sessions],
  );

  return {
    defaultModel: config?.agents.defaults.model,
    fallbackPreferredModel,
    fallbackPreferredThinking,
    isProviderStateResolved,
    isSkillsLoading,
    modelOptions,
    selectedSession,
    selectedSessionKey,
    sessionTypeState,
    skillRecords,
  };
}
