import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RuntimeModelSelectionMode } from '@nextclaw/shared';

import type { ConfigView, ProvidersView, ProviderTemplatesView } from '@/shared/lib/api';
import { useProviderModelCatalog, useUpdateProvider } from '@/shared/hooks/use-config';
import { normalizeStringList } from '@/shared/lib/provider-models';
import {
  buildNcpChatDiscoveredModelOptions,
  filterNcpChatDiscoveredModelOptionsBySessionType,
} from '@/features/chat/features/ncp/utils/ncp-chat-query-derived.utils';
import { providerModelCatalogNoticeManager } from '@/features/chat/managers/provider-model-catalog-notice.manager';

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
      return filterNcpChatDiscoveredModelOptionsBySessionType({
        modelOptions: providerModelCatalogNoticeManager.filterUnseen(catalogModelOptions),
        modelSelectionMode,
        supportedModels,
      });
    },
    [catalogModelOptions, modelSelectionMode, noticeRevision, supportedModels],
  );
  const addDiscoveredModel = useCallback(async (value: string) => {
    const option = discoveredModelOptions.find((candidate) => candidate.value === value);
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
