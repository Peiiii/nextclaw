import { useCallback, useMemo } from 'react';
import { useProviderModelCatalog } from '@/shared/hooks/use-config';
import {
  findProviderModelSuggestions,
  mergeProviderLocalModels
} from '@/features/settings/utils/provider-form-model.utils';

type UseProviderModelSuggestionsParams = {
  providerName?: string;
  models: string[];
  aliases: string[];
  fetchedModels?: string[];
  onModelsChange: (models: string[]) => void;
};

export function useProviderModelSuggestions(params: UseProviderModelSuggestionsParams) {
  const { providerName, models, aliases, fetchedModels = [], onModelsChange } = params;
  const catalogQuery = useProviderModelCatalog({
    pollWhileRefreshing: true,
    refreshOnMount: true
  });
  const catalogEntry = providerName ? catalogQuery.data?.providers[providerName] : undefined;
  const suggestionSource: 'background' | 'fetched' = fetchedModels.length > 0 ? 'fetched' : 'background';
  const suggestedModels = useMemo(
    () => findProviderModelSuggestions(
      models,
      suggestionSource === 'fetched' ? fetchedModels : catalogEntry?.models ?? [],
      aliases
    ),
    [aliases, catalogEntry?.models, fetchedModels, models, suggestionSource]
  );
  const addSuggestedModels = useCallback((selectedModels: string[]) => {
    const merged = mergeProviderLocalModels(models, selectedModels, aliases);
    if (merged.addedCount > 0) {
      onModelsChange(merged.models);
    }
  }, [aliases, models, onModelsChange]);

  return {
    addSuggestedModels,
    hasSuggestionError: Boolean(catalogEntry?.lastError && !catalogEntry.fetchedAt),
    isCheckingSuggestions: Boolean(
      providerName && (
        catalogQuery.isLoading ||
        (catalogQuery.data?.refreshing && !catalogEntry)
      )
    ),
    suggestedModels,
    suggestionSource
  };
}
