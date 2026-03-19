import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SessionEntryView } from '@/api/types';
import type { ChatModelOption } from '@/components/chat/chat-input.types';
import {
  adaptNcpSessionSummaries,
  readNcpSessionPreferredThinking
} from '@/components/chat/ncp/ncp-session-adapter';
import { useChatSessionTypeState } from '@/components/chat/useChatSessionTypeState';
import {
  resolveSelectedModelValue,
  resolveRecentSessionPreferredModel,
  useSyncSelectedModel
} from '@/components/chat/chat-page-runtime';
import {
  useConfig,
  useConfigMeta,
  useNcpSessions
} from '@/hooks/useConfig';
import { useNcpChatSessionTypes } from '@/hooks/use-ncp-chat-session-types';
import { useMarketplaceInstalled } from '@/hooks/useMarketplace';
import { buildProviderModelCatalog, composeProviderModel, resolveModelThinkingCapability } from '@/lib/provider-models';

type UseNcpChatPageDataParams = {
  query: string;
  selectedSessionKey: string | null;
  pendingSessionType: string;
  setPendingSessionType: Dispatch<SetStateAction<string>>;
  setSelectedModel: Dispatch<SetStateAction<string>>;
};

function filterSessionsByQuery(sessions: SessionEntryView[], query: string): SessionEntryView[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return sessions;
  }
  return sessions.filter((session) => session.key.toLowerCase().includes(normalizedQuery));
}

export function useNcpChatPageData(params: UseNcpChatPageDataParams) {
  const configQuery = useConfig();
  const configMetaQuery = useConfigMeta();
  const sessionsQuery = useNcpSessions({ limit: 200 });
  const sessionTypesQuery = useNcpChatSessionTypes();
  const installedSkillsQuery = useMarketplaceInstalled('skill');
  const isProviderStateResolved =
    (configQuery.isFetched || configQuery.isSuccess) &&
    (configMetaQuery.isFetched || configMetaQuery.isSuccess);

  const modelOptions = useMemo<ChatModelOption[]>(() => {
    const providers = buildProviderModelCatalog({
      meta: configMetaQuery.data,
      config: configQuery.data,
      onlyConfigured: true
    });
    const seen = new Set<string>();
    const options: ChatModelOption[] = [];
    for (const provider of providers) {
      for (const localModel of provider.models) {
        const value = composeProviderModel(provider.prefix, localModel);
        if (!value || seen.has(value)) {
          continue;
        }
        seen.add(value);
        options.push({
          value,
          modelLabel: localModel,
          providerLabel: provider.displayName,
          thinkingCapability: resolveModelThinkingCapability(provider.modelThinking, localModel, provider.aliases)
        });
      }
    }
    return options.sort((left, right) => {
      const providerCompare = left.providerLabel.localeCompare(right.providerLabel);
      if (providerCompare !== 0) {
        return providerCompare;
      }
      return left.modelLabel.localeCompare(right.modelLabel);
    });
  }, [configMetaQuery.data, configQuery.data]);

  const sessionSummaries = useMemo(
    () => sessionsQuery.data?.sessions ?? [],
    [sessionsQuery.data?.sessions]
  );
  const allSessions = useMemo(
    () => adaptNcpSessionSummaries(sessionSummaries),
    [sessionSummaries]
  );
  const sessions = useMemo(
    () => filterSessionsByQuery(allSessions, params.query),
    [allSessions, params.query]
  );
  const selectedSession = useMemo(
    () => allSessions.find((session) => session.key === params.selectedSessionKey) ?? null,
    [allSessions, params.selectedSessionKey]
  );
  const selectedSessionSummary = useMemo(
    () => sessionSummaries.find((session) => session.sessionId === params.selectedSessionKey) ?? null,
    [params.selectedSessionKey, sessionSummaries]
  );
  const skillRecords = useMemo(
    () => installedSkillsQuery.data?.records ?? [],
    [installedSkillsQuery.data?.records]
  );
  const selectedSessionThinkingLevel = useMemo(
    () => (selectedSessionSummary ? readNcpSessionPreferredThinking(selectedSessionSummary) : null),
    [selectedSessionSummary]
  );

  const sessionTypeState = useChatSessionTypeState({
    selectedSession,
    selectedSessionKey: params.selectedSessionKey,
    pendingSessionType: params.pendingSessionType,
    setPendingSessionType: params.setPendingSessionType,
    sessionTypesData: sessionTypesQuery.data
  });
  const recentSessionPreferredModel = useMemo(
    () =>
      resolveRecentSessionPreferredModel({
        sessions: allSessions,
        selectedSessionKey: params.selectedSessionKey,
        sessionType: sessionTypeState.selectedSessionType
      }),
    [allSessions, params.selectedSessionKey, sessionTypeState.selectedSessionType]
  );

  useSyncSelectedModel({
    modelOptions,
    selectedSessionKey: params.selectedSessionKey,
    selectedSessionPreferredModel: selectedSession?.preferredModel,
    fallbackPreferredModel: recentSessionPreferredModel,
    defaultModel: configQuery.data?.agents.defaults.model,
    setSelectedModel: params.setSelectedModel
  });

  const hydratedSessionModel = useMemo(
    () =>
      resolveSelectedModelValue({
        currentSelectedModel: '',
        modelOptions,
        selectedSessionPreferredModel: selectedSession?.preferredModel,
        fallbackPreferredModel: recentSessionPreferredModel,
        defaultModel: configQuery.data?.agents.defaults.model,
        preferSessionPreferredModel: true
      }),
    [configQuery.data?.agents.defaults.model, modelOptions, recentSessionPreferredModel, selectedSession?.preferredModel]
  );

  return {
    configQuery,
    configMetaQuery,
    sessionsQuery,
    sessionTypesQuery,
    installedSkillsQuery,
    isProviderStateResolved,
    modelOptions,
    sessionSummaries,
    sessions,
    skillRecords,
    selectedSession,
    hydratedSessionModel,
    selectedSessionThinkingLevel,
    ...sessionTypeState
  };
}
