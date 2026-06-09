import { useMemo } from 'react';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import { adaptNcpSessionSummaries } from '@/features/chat/features/session/utils/ncp-session-adapter.utils';
import { useChatSessionTypeState } from '@/features/chat/features/session-type/hooks/use-chat-session-type-state';
import {
  useConfig,
  useProviders,
  useProviderTemplates
} from '@/shared/hooks/use-config';
import {
  useNcpSessionSkills,
  useNcpSessions
} from '@/features/chat/features/ncp/hooks/use-ncp-session-queries';
import { useNcpChatSessionTypes } from '@/features/chat/features/session-type/hooks/use-ncp-chat-session-types';
import { buildProviderModelCatalog, composeProviderModel, resolveModelThinkingCapability } from '@/shared/lib/provider-models';

export type { ChatModelOption } from '@/features/chat/types/chat-input.types';

type UseNcpChatPageDataParams = {
  sessionKey: string | null;
};

function useNcpChatModelOptions(params: {
  config: ReturnType<typeof useConfig>['data'];
  providersView: ReturnType<typeof useProviders>['data'];
  templatesView: ReturnType<typeof useProviderTemplates>['data'];
}) {
  const { config, providersView, templatesView } = params;
  return useMemo<ChatModelOption[]>(() => {
    const providers = buildProviderModelCatalog({
      providersView,
      templatesView,
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
  }, [config, providersView, templatesView]);
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
    sessionKey,
  } = params;
  const configQuery = useConfig();
  const providersQuery = useProviders();
  const templatesQuery = useProviderTemplates();
  const sessionsQuery = useNcpSessions({ limit: 200 });
  const sessionTypesQuery = useNcpChatSessionTypes();
  const sessionSkillsQuery = useNcpSessionSkills({
    sessionId: sessionKey?.trim() || 'draft-session'
  });
  const isProviderStateResolved =
    (configQuery.isFetched || configQuery.isSuccess) &&
    (providersQuery.isFetched || providersQuery.isSuccess) &&
    (templatesQuery.isFetched || templatesQuery.isSuccess);
  const modelOptions = useNcpChatModelOptions({
    config: configQuery.data,
    providersView: providersQuery.data,
    templatesView: templatesQuery.data
  });

  const sessionSummaries = useMemo(
    () => sessionsQuery.data?.sessions ?? [],
    [sessionsQuery.data?.sessions]
  );
  const allSessions = useMemo(
    () => adaptNcpSessionSummaries(sessionSummaries),
    [sessionSummaries]
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
    pendingSessionType: '',
    setPendingSessionType: () => undefined,
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
  return {
    configQuery,
    providersQuery,
    templatesQuery,
    sessionsQuery,
    sessionTypesQuery,
    sessionSkillsQuery,
    isProviderStateResolved,
    modelOptions: filteredModelOptions,
    sessionSummaries,
    skillRecords,
    selectedSession,
    ...sessionTypeState
  };
}
