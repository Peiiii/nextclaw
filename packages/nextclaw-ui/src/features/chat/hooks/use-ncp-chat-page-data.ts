import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SessionEntryView, ThinkingLevel } from '@/api/types';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import { sessionMatchesQuery } from '@/features/chat/utils/chat-session-display.utils';
import { adaptNcpSessionSummaries } from '@/features/chat/utils/ncp-session-adapter.utils';
import { useChatSessionTypeState } from '@/features/chat/hooks/use-chat-session-type-state';
import {
  resolveRecentSessionPreferredThinking,
  resolveRecentSessionPreferredModel,
  useSyncSelectedModel,
  useSyncSelectedThinking
} from '@/features/chat/utils/chat-session-preference-governance.utils';
import {
  useConfig,
  useConfigMeta,
  useNcpSessionSkills,
  useNcpSessions
} from '@/shared/hooks/use-config';
import { useNcpChatSessionTypes } from './use-ncp-chat-session-types';
import { buildProviderModelCatalog, composeProviderModel, resolveModelThinkingCapability } from '@/lib/provider-models';

export type { ChatModelOption } from '@/features/chat/types/chat-input.types';

type UseNcpChatPageDataParams = {
  query: string;
  sessionKey: string;
  projectRootOverride?: string | null;
  currentSelectedModel: string;
  pendingSessionType: string;
  setPendingSessionType: Dispatch<SetStateAction<string>>;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  setSelectedThinkingLevel: Dispatch<SetStateAction<ThinkingLevel | null>>;
};

function filterSessionsByQuery(sessions: SessionEntryView[], query: string): SessionEntryView[] {
  return sessions.filter((session) => sessionMatchesQuery(session, query));
}

function useNcpChatModelOptions(params: {
  config: ReturnType<typeof useConfig>['data'];
  meta: ReturnType<typeof useConfigMeta>['data'];
}) {
  const { config, meta } = params;
  return useMemo<ChatModelOption[]>(() => {
    const providers = buildProviderModelCatalog({
      meta,
      config,
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
  }, [config, meta]);
}

function useRecentSessionPreferences(params: {
  sessions: SessionEntryView[];
  sessionKey: string;
  sessionType: string;
}) {
  const { sessions, sessionKey, sessionType } = params;
  const recentSessionPreferredModel = useMemo(
    () =>
      resolveRecentSessionPreferredModel({
        sessions,
        selectedSessionKey: sessionKey,
        sessionType
      }),
    [sessionKey, sessionType, sessions]
  );
  const recentSessionPreferredThinking = useMemo(
    () =>
      resolveRecentSessionPreferredThinking({
        sessions,
        selectedSessionKey: sessionKey,
        sessionType
      }),
    [sessionKey, sessionType, sessions]
  );
  return {
    recentSessionPreferredModel,
    recentSessionPreferredThinking
  };
}

function useCurrentModelThinkingState(params: {
  currentSelectedModel: string;
  modelOptions: ChatModelOption[];
}) {
  const { currentSelectedModel, modelOptions } = params;
  const currentModelOption = useMemo(
    () => modelOptions.find((option) => option.value === currentSelectedModel),
    [currentSelectedModel, modelOptions]
  );
  const supportedThinkingLevels = useMemo(
    () => (currentModelOption?.thinkingCapability?.supported as ThinkingLevel[] | undefined) ?? [],
    [currentModelOption?.thinkingCapability?.supported]
  );
  const defaultThinkingLevel = useMemo(
    () => (currentModelOption?.thinkingCapability?.default as ThinkingLevel | null | undefined) ?? null,
    [currentModelOption?.thinkingCapability?.default]
  );
  return {
    supportedThinkingLevels,
    defaultThinkingLevel
  };
}

export function filterModelOptionsBySessionType(params: {
  modelOptions: ChatModelOption[];
  supportedModels?: string[];
}): ChatModelOption[] {
  const { modelOptions, supportedModels } = params;
  if (!supportedModels || supportedModels.length === 0) {
    return modelOptions;
  }
  const supportedModelSet = new Set(supportedModels);
  const filtered = modelOptions.filter((option) => supportedModelSet.has(option.value));
  return filtered.length > 0 ? filtered : modelOptions;
}

export function useNcpChatPageData(params: UseNcpChatPageDataParams) {
  const {
    currentSelectedModel,
    pendingSessionType,
    projectRootOverride,
    query,
    sessionKey,
    setPendingSessionType,
    setSelectedModel,
    setSelectedThinkingLevel,
  } = params;
  const configQuery = useConfig();
  const configMetaQuery = useConfigMeta();
  const sessionsQuery = useNcpSessions({ limit: 200 });
  const sessionTypesQuery = useNcpChatSessionTypes();
  const sessionSkillsQuery = useNcpSessionSkills({
    sessionId: sessionKey,
    ...(Object.prototype.hasOwnProperty.call(params, 'projectRootOverride')
      ? { projectRoot: projectRootOverride ?? null }
      : {})
  });
  const isProviderStateResolved =
    (configQuery.isFetched || configQuery.isSuccess) &&
    (configMetaQuery.isFetched || configMetaQuery.isSuccess);
  const modelOptions = useNcpChatModelOptions({
    config: configQuery.data,
    meta: configMetaQuery.data
  });

  const sessionSummaries = useMemo(
    () => sessionsQuery.data?.sessions ?? [],
    [sessionsQuery.data?.sessions]
  );
  const allSessions = useMemo(
    () => adaptNcpSessionSummaries(sessionSummaries),
    [sessionSummaries]
  );
  const sessions = useMemo(
    () => filterSessionsByQuery(allSessions, query),
    [allSessions, query]
  );
  const selectedSession = useMemo(
    () => allSessions.find((session) => session.key === sessionKey) ?? null,
    [allSessions, sessionKey]
  );
  const skillRecords = useMemo(
    () => sessionSkillsQuery.data?.records ?? [],
    [sessionSkillsQuery.data?.records]
  );
  const sessionTypeState = useChatSessionTypeState({
    selectedSession,
    pendingSessionType,
    setPendingSessionType,
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
  const { recentSessionPreferredModel, recentSessionPreferredThinking } =
    useRecentSessionPreferences({
      sessions: allSessions,
      sessionKey,
      sessionType: sessionTypeState.selectedSessionType
    });
  const { supportedThinkingLevels, defaultThinkingLevel } =
    useCurrentModelThinkingState({
      currentSelectedModel,
      modelOptions: filteredModelOptions
    });

  useSyncSelectedModel({
    modelOptions: filteredModelOptions,
    selectedSessionKey: sessionKey,
    selectedSessionExists: Boolean(selectedSession),
    selectedSessionPreferredModel: selectedSession?.preferredModel,
    fallbackPreferredModel: sessionTypeState.selectedSessionTypeOption?.recommendedModel ?? recentSessionPreferredModel,
    defaultModel: sessionTypeState.selectedSessionTypeOption?.recommendedModel ?? configQuery.data?.agents.defaults.model,
    setSelectedModel
  });
  useSyncSelectedThinking({
    supportedThinkingLevels,
    selectedSessionKey: sessionKey,
    selectedSessionExists: Boolean(selectedSession),
    selectedSessionPreferredThinking: selectedSession?.preferredThinking ?? null,
    fallbackPreferredThinking: recentSessionPreferredThinking ?? null,
    defaultThinkingLevel,
    setSelectedThinkingLevel
  });

  return {
    configQuery,
    configMetaQuery,
    sessionsQuery,
    sessionTypesQuery,
    sessionSkillsQuery,
    isProviderStateResolved,
    modelOptions: filteredModelOptions,
    sessionSummaries,
    sessions,
    skillRecords,
    selectedSession,
    ...sessionTypeState
  };
}
