import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SessionEntryView, ThinkingLevel } from '@/api/types';
import type { ChatModelOption } from '@/components/chat/chat-input.types';
import { sessionMatchesQuery } from '@/components/chat/chat-session-display';
import { adaptNcpSessionSummaries } from '@/components/chat/ncp/ncp-session-adapter';
import { useChatSessionTypeState } from '@/components/chat/useChatSessionTypeState';
import {
  resolveRecentSessionPreferredThinking,
  resolveRecentSessionPreferredModel,
  useSyncSelectedModel,
  useSyncSelectedThinking
} from '@/components/chat/chat-session-preference-governance';
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
  sessionKey: string;
  currentSelectedModel: string;
  pendingSessionType: string;
  setPendingSessionType: Dispatch<SetStateAction<string>>;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  setSelectedThinkingLevel: Dispatch<SetStateAction<ThinkingLevel | null>>;
};

function filterSessionsByQuery(sessions: SessionEntryView[], query: string): SessionEntryView[] {
  return sessions.filter((session) => sessionMatchesQuery(session, query));
}

export function filterModelOptionsBySessionType(params: {
  modelOptions: ChatModelOption[];
  supportedModels?: string[];
}): ChatModelOption[] {
  if (!params.supportedModels || params.supportedModels.length === 0) {
    return params.modelOptions;
  }
  const supportedModelSet = new Set(params.supportedModels);
  const filtered = params.modelOptions.filter((option) => supportedModelSet.has(option.value));
  return filtered.length > 0 ? filtered : params.modelOptions;
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
    () => allSessions.find((session) => session.key === params.sessionKey) ?? null,
    [allSessions, params.sessionKey]
  );
  const skillRecords = useMemo(
    () => installedSkillsQuery.data?.records ?? [],
    [installedSkillsQuery.data?.records]
  );
  const sessionTypeState = useChatSessionTypeState({
    selectedSession,
    selectedSessionKey: params.sessionKey,
    pendingSessionType: params.pendingSessionType,
    setPendingSessionType: params.setPendingSessionType,
    sessionTypesData: sessionTypesQuery.data
  });
  const filteredModelOptions = useMemo(
    () =>
      filterModelOptionsBySessionType({
        modelOptions,
        supportedModels: sessionTypeState.selectedSessionTypeOption?.supportedModels
      }),
    [modelOptions, sessionTypeState.selectedSessionTypeOption?.supportedModels]
  );
  const recentSessionPreferredModel = useMemo(
    () =>
      resolveRecentSessionPreferredModel({
        sessions: allSessions,
        selectedSessionKey: params.sessionKey,
        sessionType: sessionTypeState.selectedSessionType
      }),
    [allSessions, params.sessionKey, sessionTypeState.selectedSessionType]
  );
  const currentModelOption = useMemo(
    () => filteredModelOptions.find((option) => option.value === params.currentSelectedModel),
    [filteredModelOptions, params.currentSelectedModel]
  );
  const supportedThinkingLevels = useMemo(
    () => (currentModelOption?.thinkingCapability?.supported as ThinkingLevel[] | undefined) ?? [],
    [currentModelOption?.thinkingCapability?.supported]
  );
  const defaultThinkingLevel = useMemo(
    () => (currentModelOption?.thinkingCapability?.default as ThinkingLevel | null | undefined) ?? null,
    [currentModelOption?.thinkingCapability?.default]
  );
  const recentSessionPreferredThinking = useMemo(
    () =>
      resolveRecentSessionPreferredThinking({
        sessions: allSessions,
        selectedSessionKey: params.sessionKey,
        sessionType: sessionTypeState.selectedSessionType
      }),
    [allSessions, params.sessionKey, sessionTypeState.selectedSessionType]
  );

  useSyncSelectedModel({
    modelOptions: filteredModelOptions,
    selectedSessionKey: params.sessionKey,
    selectedSessionExists: Boolean(selectedSession),
    selectedSessionPreferredModel: selectedSession?.preferredModel,
    fallbackPreferredModel: sessionTypeState.selectedSessionTypeOption?.recommendedModel ?? recentSessionPreferredModel,
    defaultModel: sessionTypeState.selectedSessionTypeOption?.recommendedModel ?? configQuery.data?.agents.defaults.model,
    setSelectedModel: params.setSelectedModel
  });
  useSyncSelectedThinking({
    supportedThinkingLevels,
    selectedSessionKey: params.sessionKey,
    selectedSessionExists: Boolean(selectedSession),
    selectedSessionPreferredThinking: selectedSession?.preferredThinking ?? null,
    fallbackPreferredThinking: recentSessionPreferredThinking ?? null,
    defaultThinkingLevel,
    setSelectedThinkingLevel: params.setSelectedThinkingLevel
  });

  return {
    configQuery,
    configMetaQuery,
    sessionsQuery,
    sessionTypesQuery,
    installedSkillsQuery,
    isProviderStateResolved,
    modelOptions: filteredModelOptions,
    sessionSummaries,
    sessions,
    skillRecords,
    selectedSession,
    ...sessionTypeState
  };
}
