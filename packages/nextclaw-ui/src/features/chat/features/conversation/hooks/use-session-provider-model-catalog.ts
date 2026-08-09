import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RuntimeModelSelectionMode } from '@nextclaw/shared';

import type { ConfigView, ProvidersView, ProviderTemplatesView } from '@/shared/lib/api';
import { useProviderModelCatalog, useUpdateProvider } from '@/shared/hooks/use-config';
import { normalizeStringList } from '@/shared/lib/provider-models';
import type { DiscoveredChatModelOption } from '@/features/chat/types/chat-input.types';
import {
  buildNcpChatDiscoveredModelOptions,
  filterNcpChatDiscoveredModelOptionsBySessionType,
} from '@/features/chat/features/ncp/utils/ncp-chat-query-derived.utils';
import { providerModelCatalogNoticeManager } from '@/features/chat/managers/provider-model-catalog-notice.manager';

const MODEL_DISCOVERY_PREVIEW_PROVIDER_PREFIX = '__nextclaw-preview__';
const MODEL_DISCOVERY_PREVIEW_GROUPS = [
  {
    providerId: 'opencode',
    providerLabel: 'OpenCode Zen Free Trial',
    models: [
      'deepseek-v4-flash-free',
      'laguna-s-2.1-free',
      'longcat-2.0-free',
      'mimo-v2.5-free',
      'nemotron-3-ultra-free',
      'north-mini-code-free',
      'trinity-large-preview-free',
    ],
  },
  {
    providerId: 'openrouter',
    providerLabel: 'OpenRouter',
    models: [
      'inclusionai/ling-3.0-tiny:free',
      'qwen/qwen3-coder:free',
      'deepseek/deepseek-r1:free',
      'mistralai/mistral-small:free',
      'google/gemma-3-27b-it:free',
    ],
  },
  {
    providerId: 'kimi',
    providerLabel: 'Kimi',
    models: ['kimi-k2.5-preview', 'kimi-dev-72b', 'moonshot-v1-128k-preview'],
  },
] as const;

export function buildProviderModelDiscoveryPreviewOptions(params: {
  enabled: boolean;
  search: string;
}): DiscoveredChatModelOption[] {
  if (!params.enabled || new URLSearchParams(params.search).get('preview') !== 'model-discovery') {
    return [];
  }
  return MODEL_DISCOVERY_PREVIEW_GROUPS.flatMap((group) =>
    group.models.map((model) => ({
      value: `${MODEL_DISCOVERY_PREVIEW_PROVIDER_PREFIX}${group.providerId}/${model}`,
      providerId: `${MODEL_DISCOVERY_PREVIEW_PROVIDER_PREFIX}${group.providerId}`,
      providerModel: model,
      modelLabel: model,
      providerLabel: group.providerLabel,
      thinkingCapability: null,
    })),
  );
}

function isProviderModelDiscoveryPreviewOption(option: DiscoveredChatModelOption): boolean {
  return option.providerId.startsWith(MODEL_DISCOVERY_PREVIEW_PROVIDER_PREFIX);
}

type UseSessionProviderModelCatalogParams = {
  readonly config: ConfigView | null;
  readonly providersView: ProvidersView | null;
  readonly templatesView: ProviderTemplatesView | null;
  readonly modelSelectionMode?: RuntimeModelSelectionMode;
  readonly supportedModels?: string[];
};

export function useSessionProviderModelCatalog(params: UseSessionProviderModelCatalogParams) {
  const {
    config,
    modelSelectionMode,
    providersView,
    supportedModels,
    templatesView,
  } = params;
  const catalogQuery = useProviderModelCatalog();
  const { mutateAsync: updateProvider } = useUpdateProvider();
  const [noticeRevision, setNoticeRevision] = useState(0);
  const [previewDismissed, setPreviewDismissed] = useState(false);
  const previewModelOptions = useMemo(
    () => buildProviderModelDiscoveryPreviewOptions({
      enabled: import.meta.env.DEV && !import.meta.env.VITEST,
      search: typeof window === 'undefined' ? '' : window.location.search,
    }),
    [],
  );
  const catalogModelOptions = useMemo(
    () => buildNcpChatDiscoveredModelOptions({
      catalogView: catalogQuery.data ?? null,
      config,
      providersView,
      templatesView,
    }),
    [catalogQuery.data, config, providersView, templatesView],
  );
  useEffect(() => {
    providerModelCatalogNoticeManager.initializeLargeCatalogs(catalogModelOptions);
  }, [catalogModelOptions]);
  const discoveredModelOptions = useMemo(
    () => {
      void noticeRevision;
      if (previewModelOptions.length > 0 && !previewDismissed) {
        return previewModelOptions;
      }
      return filterNcpChatDiscoveredModelOptionsBySessionType({
        modelOptions: providerModelCatalogNoticeManager.filterUnseen(catalogModelOptions),
        modelSelectionMode,
        supportedModels,
      });
    },
    [catalogModelOptions, modelSelectionMode, noticeRevision, previewDismissed, previewModelOptions, supportedModels],
  );
  const addDiscoveredModel = useCallback(async (value: string) => {
    const option = discoveredModelOptions.find((candidate) => candidate.value === value);
    if (option && isProviderModelDiscoveryPreviewOption(option)) {
      return option;
    }
    const provider = option ? providersView?.providers[option.providerId] : undefined;
    if (!option || !provider) {
      return null;
    }
    await updateProvider({
      provider: option.providerId,
      data: {
        models: normalizeStringList([...(provider.models ?? []), option.providerModel]),
      },
      silentSuccess: true,
    });
    providerModelCatalogNoticeManager.acknowledge([option]);
    setNoticeRevision((current) => current + 1);
    return option;
  }, [discoveredModelOptions, providersView, updateProvider]);
  const dismissDiscoveredModels = useCallback(() => {
    if (discoveredModelOptions.some(isProviderModelDiscoveryPreviewOption)) {
      setPreviewDismissed(true);
      return;
    }
    if (providerModelCatalogNoticeManager.acknowledge(discoveredModelOptions)) {
      setNoticeRevision((current) => current + 1);
    }
  }, [discoveredModelOptions]);

  return {
    addDiscoveredModel,
    dismissDiscoveredModels,
    discoveredModelOptions,
    refreshProviderModelCatalog: catalogQuery.refetch,
  };
}
