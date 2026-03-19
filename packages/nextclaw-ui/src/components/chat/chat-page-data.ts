import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { SessionEntryView, ThinkingLevel } from '@/api/types';
import type { ChatModelOption } from '@/components/chat/chat-input.types';
import { useChatSessionTypeState } from '@/components/chat/useChatSessionTypeState';
import {
  resolveSelectedModelValue,
  resolveRecentSessionPreferredModel,
  useSyncSelectedModel
} from '@/components/chat/chat-page-runtime';
import {
  useChatCapabilities,
  useChatSessionTypes,
  useConfig,
  useConfigMeta,
  useSessionHistory,
  useSessions,
} from '@/hooks/useConfig';
import { useMarketplaceInstalled } from '@/hooks/useMarketplace';
import { buildProviderModelCatalog, composeProviderModel, resolveModelThinkingCapability } from '@/lib/provider-models';

type UseChatPageDataParams = {
  query: string;
  selectedSessionKey: string | null;
  selectedAgentId: string;
  pendingSessionType: string;
  setPendingSessionType: Dispatch<SetStateAction<string>>;
  setSelectedModel: Dispatch<SetStateAction<string>>;
};

const THINKING_LEVEL_SET = new Set<string>(['off', 'minimal', 'low', 'medium', 'high', 'adaptive', 'xhigh']);

function parseThinkingLevel(value: unknown): ThinkingLevel | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return THINKING_LEVEL_SET.has(normalized) ? (normalized as ThinkingLevel) : null;
}

export function useChatPageData(params: UseChatPageDataParams) {
  const configQuery = useConfig();
  const configMetaQuery = useConfigMeta();
  const sessionsQuery = useSessions({ q: params.query.trim() || undefined, limit: 120, activeMinutes: 0 });
  const installedSkillsQuery = useMarketplaceInstalled('skill');
  const chatCapabilitiesQuery = useChatCapabilities({
    sessionKey: params.selectedSessionKey,
    agentId: params.selectedAgentId
  });
  const historyQuery = useSessionHistory(params.selectedSessionKey, 300);
  const sessionTypesQuery = useChatSessionTypes();
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

  const sessions = useMemo(() => sessionsQuery.data?.sessions ?? [], [sessionsQuery.data?.sessions]);
  const skillRecords = useMemo(() => installedSkillsQuery.data?.records ?? [], [installedSkillsQuery.data?.records]);
  const selectedSession = useMemo(
    () => sessions.find((session) => session.key === params.selectedSessionKey) ?? null,
    [params.selectedSessionKey, sessions]
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
        sessions,
        selectedSessionKey: params.selectedSessionKey,
        sessionType: sessionTypeState.selectedSessionType
      }),
    [params.selectedSessionKey, sessionTypeState.selectedSessionType, sessions]
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

  const historyMessages = useMemo(() => historyQuery.data?.messages ?? [], [historyQuery.data?.messages]);
  const selectedSessionThinkingLevel = useMemo(() => {
    if (!params.selectedSessionKey) {
      return null;
    }
    const metadata = historyQuery.data?.metadata;
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }
    const candidates = [
      metadata.preferred_thinking,
      metadata.thinking,
      metadata.thinking_level,
      metadata.thinkingLevel
    ];
    for (const value of candidates) {
      const level = parseThinkingLevel(value);
      if (level) {
        return level;
      }
    }
    return null;
  }, [historyQuery.data?.metadata, params.selectedSessionKey]);

  return {
    configQuery,
    configMetaQuery,
    sessionsQuery,
    installedSkillsQuery,
    chatCapabilitiesQuery,
    historyQuery,
    sessionTypesQuery,
    isProviderStateResolved,
    modelOptions,
    sessions,
    skillRecords,
    selectedSession,
    hydratedSessionModel,
    historyMessages,
    selectedSessionThinkingLevel,
    ...sessionTypeState
  };
}

export function sessionDisplayName(session: SessionEntryView): string {
  if (session.label && session.label.trim()) {
    return session.label.trim();
  }
  const chunks = session.key.split(':');
  return chunks[chunks.length - 1] || session.key;
}
