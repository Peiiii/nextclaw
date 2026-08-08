import { useCallback, useMemo, useState } from 'react';
import { NextClawClientError } from '@nextclaw/client-sdk';
import { toast } from 'sonner';
import { useDiscoverProviderModels, useTestProviderConnection } from '@/shared/hooks/use-config';
import { t } from '@/shared/lib/i18n';
import {
  buildProviderConnectionTestPayload,
  buildProviderModelDiscoveryPayload,
  type WireApiType
} from '@/features/settings/utils/provider-form-support.utils';

type UseProviderConnectivityParams = {
  providerName?: string;
  apiKey: string;
  apiKeyRequired: boolean;
  apiKeySet: boolean;
  apiBase: string;
  extraHeaders: Record<string, string> | null;
  supportsWireApi: boolean;
  wireApi: WireApiType;
  models: string[];
  providerModelAliases: string[];
};

type ProviderModelDiscovery = {
  key: string;
  models: string[];
};

export function useProviderConnectivity(params: UseProviderConnectivityParams) {
  const {
    providerName,
    apiKey,
    apiKeyRequired,
    apiKeySet,
    apiBase,
    extraHeaders,
    supportsWireApi,
    wireApi,
    models,
    providerModelAliases,
  } = params;
  const testProviderConnection = useTestProviderConnection();
  const discoverProviderModels = useDiscoverProviderModels();
  const discoveryKey = useMemo(() => JSON.stringify({
    providerName,
    apiKey,
    apiBase,
    extraHeaders
  }), [apiBase, apiKey, extraHeaders, providerName]);
  const [modelDiscovery, setModelDiscovery] = useState<ProviderModelDiscovery | null>(null);

  const testConnection = useCallback(async () => {
    if (!providerName) {
      return;
    }
    try {
      const result = await testProviderConnection.mutateAsync({
        provider: providerName,
        data: buildProviderConnectionTestPayload({
          apiKey,
          apiBase,
          extraHeaders,
          supportsWireApi,
          wireApi,
          models,
          providerModelAliases
        })
      });
      if (result.success) {
        toast.success(`${t('providerTestConnectionSuccess')} (${result.latencyMs}ms)`);
        return;
      }
      const details = [`provider=${result.provider}`, `latency=${result.latencyMs}ms`];
      if (result.model) {
        details.push(`model=${result.model}`);
      }
      toast.error(`${t('providerTestConnectionFailed')}: ${result.message} | ${details.join(' | ')}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('providerTestConnectionFailed')}: ${message}`);
    }
  }, [
    apiBase,
    apiKey,
    extraHeaders,
    models,
    providerModelAliases,
    providerName,
    supportsWireApi,
    testProviderConnection,
    wireApi
  ]);

  const discoverModels = useCallback(async () => {
    if (!providerName) {
      return null;
    }
    if (apiKeyRequired && !apiKey.trim() && !apiKeySet) {
      toast.error(t('providerModelsApiKeyRequired'));
      return null;
    }
    try {
      const result = await discoverProviderModels.mutateAsync({
        provider: providerName,
        data: buildProviderModelDiscoveryPayload({ apiKey, apiBase, extraHeaders })
      });
      setModelDiscovery({ key: discoveryKey, models: result.models });
      toast.success(t('providerModelsFetchSuccess'));
      return result.models;
    } catch (error) {
      if (
        error instanceof NextClawClientError &&
        (error.details?.upstreamStatus === 401 || error.details?.upstreamStatus === 403)
      ) {
        toast.error(t('providerModelsAuthorizationFailed'));
        return null;
      }
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('providerModelsFetchFailed')}: ${message}`);
      return null;
    }
  }, [apiBase, apiKey, apiKeyRequired, apiKeySet, discoverProviderModels, discoveryKey, extraHeaders, providerName]);

  return {
    discoverModels,
    fetchedModels: modelDiscovery?.key === discoveryKey ? modelDiscovery.models : [],
    isDiscoveringModels: discoverProviderModels.isPending,
    isTestPending: testProviderConnection.isPending,
    testConnection
  };
}
