import { useMemo, type SetStateAction } from 'react';

import type { NcpSessionSummaryView, SessionSkillEntryView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';
import { normalizeSessionProjectRootValue } from '@/shared/lib/session-project';
import {
  useNcpSessionSkills,
} from '@/features/chat/features/ncp/hooks/use-ncp-session-queries';
import { useNcpChatProviderStateResolved } from '@/features/chat/features/ncp/hooks/use-ncp-chat-derived-state';
import {
  buildNcpChatProviderModelOptions,
  filterNcpChatModelOptionsBySessionType,
} from '@/features/chat/features/ncp/utils/ncp-chat-query-derived.utils';
import { adaptNcpSessionSummaries } from '@/features/chat/features/session/utils/ncp-session-adapter.utils';
import { resolveRecentSessionPreferredValue } from '@/features/chat/features/session/utils/chat-session-preference-governance.utils';
import { useChatSessionTypeState } from '@/features/chat/features/session-type/hooks/use-chat-session-type-state';
import { chatRecentModelsManager } from '@/features/chat/managers/chat-recent-models.manager';
import { useChatQueryStore } from '@/features/chat/stores/ncp-chat-query.store';

import type { SessionConversationInputSnapshot } from './use-session-conversation-input-state';

const EMPTY_SESSION_SKILL_RECORDS: SessionSkillEntryView[] = [];
const EMPTY_NCP_SESSION_SUMMARIES: NcpSessionSummaryView[] = [];

type UseSessionConversationInputQueryParams = {
  readonly sessionKey: string | null;
  readonly inputSnapshot: SessionConversationInputSnapshot;
  readonly setPendingSessionType: (sessionType: SetStateAction<string>) => void;
};

export function useSessionConversationInputQuery(params: UseSessionConversationInputQueryParams) {
  const {
    sessionKey,
    inputSnapshot,
    setPendingSessionType,
  } = params;
  const selectedSessionKey = sessionKey ?? null;
  const isProviderStateResolved = useNcpChatProviderStateResolved();
  const querySnapshot = useChatQueryStore((state) => state.snapshot);
  const config = querySnapshot.configQuery?.data ?? null;
  const sessionSummaries =
    querySnapshot.sessionsQuery?.data?.sessions ?? EMPTY_NCP_SESSION_SUMMARIES;
  const sessionSkillsQuery = useNcpSessionSkills({
    sessionId: selectedSessionKey?.trim() || 'draft-session',
    projectRoot: normalizeSessionProjectRootValue(inputSnapshot.pendingProjectRoot),
  });
  const skillRecords =
    sessionSkillsQuery.data?.records ?? EMPTY_SESSION_SKILL_RECORDS;
  const isSkillsLoading = Boolean(
    sessionSkillsQuery.isLoading ||
      sessionSkillsQuery.isFetching,
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
    pendingSessionType: inputSnapshot.pendingSessionType,
    setPendingSessionType,
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
        runtimeDefaultThinkingCapability:
          sessionTypeState.selectedSessionTypeOption?.runtimeDefaultThinking ?? null,
        runtimeDefaultModelLabel: t('chatRuntimeDefaultModel'),
        supportedModels: sessionTypeState.selectedSessionTypeOption?.supportedModels,
      }),
    [
      providerModelOptions,
      sessionTypeState.selectedSessionTypeOption?.modelSelectionMode,
      sessionTypeState.selectedSessionTypeOption?.runtimeDefaultThinking,
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
    defaultProjectRoot: normalizeSessionProjectRootValue(config?.agents.defaults.workspace),
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
