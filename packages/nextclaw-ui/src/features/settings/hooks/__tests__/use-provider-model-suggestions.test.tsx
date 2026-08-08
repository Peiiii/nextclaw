import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProviderModelSuggestions } from '@/features/settings/hooks/use-provider-model-suggestions';

const catalogQuery = vi.hoisted(() => ({
  data: {
    refreshing: false,
    providers: {
      openrouter: {
        fetchedAt: '2026-08-07T00:00:00.000Z',
        lastError: null,
        models: [
          'openrouter/gpt-5',
          'openrouter/inclusionai/ling-3.0-tiny:free',
          'openrouter/meta/muse-spark-1.2',
        ],
      },
      moonshot: {
        fetchedAt: null,
        lastError: null as { message: string; occurredAt: string } | null,
        models: [],
      },
    },
  },
  isLoading: false,
}));

vi.mock('@/shared/hooks/use-config', () => ({
  useProviderModelCatalog: () => catalogQuery,
}));

describe('useProviderModelSuggestions', () => {
  beforeEach(() => {
    catalogQuery.data.refreshing = false;
    catalogQuery.data.providers.moonshot.lastError = null;
    catalogQuery.isLoading = false;
  });

  it('automatically derives only the selected provider additions and updates the form draft', () => {
    const onModelsChange = vi.fn();
    const { result } = renderHook(() => useProviderModelSuggestions({
      providerName: 'openrouter',
      models: ['gpt-5'],
      aliases: ['openrouter'],
      onModelsChange,
    }));

    expect(result.current.suggestedModels).toEqual([
      'inclusionai/ling-3.0-tiny:free',
      'meta/muse-spark-1.2',
    ]);

    expect(result.current.suggestionSource).toBe('background');
    act(() => result.current.addSuggestedModels(['inclusionai/ling-3.0-tiny:free']));
    expect(onModelsChange).toHaveBeenCalledWith(['gpt-5', 'inclusionai/ling-3.0-tiny:free']);

    act(() => result.current.addSuggestedModels(result.current.suggestedModels));
    expect(onModelsChange).toHaveBeenLastCalledWith([
      'gpt-5',
      'inclusionai/ling-3.0-tiny:free',
      'meta/muse-spark-1.2',
    ]);
  });

  it('uses an explicitly fetched catalog instead of the saved-provider background snapshot', () => {
    const { result } = renderHook(() => useProviderModelSuggestions({
      providerName: 'openrouter',
      models: ['gpt-5'],
      aliases: ['openrouter'],
      fetchedModels: ['openrouter/gpt-5', 'openrouter/qwen/qwen3.8-max'],
      onModelsChange: vi.fn(),
    }));

    expect(result.current.suggestionSource).toBe('fetched');
    expect(result.current.suggestedModels).toEqual(['qwen/qwen3.8-max']);
  });

  it('reports the initial background lookup without suggesting another provider catalog', () => {
    catalogQuery.isLoading = true;
    const { result } = renderHook(() => useProviderModelSuggestions({
      providerName: 'anthropic',
      models: [],
      aliases: ['anthropic'],
      onModelsChange: vi.fn(),
    }));

    expect(result.current.isCheckingSuggestions).toBe(true);
    expect(result.current.suggestedModels).toEqual([]);
  });

  it('reports a provider failure instead of inheriting another provider loading state', () => {
    catalogQuery.data.refreshing = true;
    catalogQuery.data.providers.moonshot.lastError = {
      message: 'Provider model discovery failed with HTTP 401 Unauthorized',
      occurredAt: '2026-08-08T00:00:00.000Z',
    };
    const { result } = renderHook(() => useProviderModelSuggestions({
      providerName: 'moonshot',
      models: [],
      aliases: ['moonshot'],
      onModelsChange: vi.fn(),
    }));

    expect(result.current.isCheckingSuggestions).toBe(false);
    expect(result.current.hasSuggestionError).toBe(true);
  });
});
