import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionProviderModelCatalog } from '@/features/chat/features/conversation/hooks/use-session-provider-model-catalog';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  updateProvider: vi.fn(),
}));

vi.mock('@/shared/hooks/use-config', () => ({
  useProviderModelCatalog: () => ({
    data: {
      refreshIntervalMs: 43_200_000,
      refreshing: false,
      lastRefreshStartedAt: '2026-08-07T00:00:00.000Z',
      lastRefreshCompletedAt: '2026-08-07T00:00:01.000Z',
      providers: {
        opencode: {
          providerId: 'opencode',
          models: ['big-pickle', 'deepseek-v4-flash-free'],
          source: 'catalog',
          fetchedAt: '2026-08-07T00:00:00.500Z',
          lastError: null,
        },
      },
    },
    refetch: mocks.refetch,
  }),
  useUpdateProvider: () => ({ mutateAsync: mocks.updateProvider }),
}));

const providersView = {
  providers: {
    opencode: {
      providerId: 'opencode',
      providerType: 'opencode',
      isBuiltInType: true,
      isCustom: false,
      enabled: true,
      displayName: 'OpenCode Zen Free Trial',
      apiKeyRequired: false,
      apiKeySet: false,
      models: ['big-pickle'],
    },
  },
};

const templatesView = {
  providerTemplates: [{
    id: 'opencode',
    providerType: 'opencode',
    displayName: 'OpenCode Zen Free Trial',
    modelPrefix: 'opencode',
    keywords: [],
    envKey: 'OPENCODE_API_KEY',
    apiKeyRequired: false,
  }],
};

describe('useSessionProviderModelCatalog', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.refetch.mockReset();
    mocks.updateProvider.mockReset().mockResolvedValue(providersView.providers.opencode);
  });

  it('adds exactly the selected discovered model through the existing provider update path', async () => {
    const { result } = renderHook(() => useSessionProviderModelCatalog({
      config: null,
      providersView,
      templatesView,
      modelSelectionMode: 'nextclaw',
    }));

    expect(result.current.discoveredModelOptions.map((option) => option.value)).toEqual([
      'opencode/deepseek-v4-flash-free',
    ]);
    let addedModel: Awaited<ReturnType<typeof result.current.addDiscoveredModel>> = null;
    await act(async () => {
      addedModel = await result.current.addDiscoveredModel('opencode/deepseek-v4-flash-free');
    });

    expect(mocks.updateProvider).toHaveBeenCalledWith({
      provider: 'opencode',
      data: { models: ['big-pickle', 'deepseek-v4-flash-free'] },
      silentSuccess: true,
    });
    expect(addedModel).toMatchObject({
      value: 'opencode/deepseek-v4-flash-free',
      providerId: 'opencode',
      providerModel: 'deepseek-v4-flash-free',
    });
    expect(result.current.refreshProviderModelCatalog).toBe(mocks.refetch);
  });

  it('lets the user mark the current discovery batch as seen without adding it', () => {
    const { result } = renderHook(() => useSessionProviderModelCatalog({
      config: null,
      providersView,
      templatesView,
      modelSelectionMode: 'nextclaw',
    }));

    expect(result.current.discoveredModelOptions).toHaveLength(1);
    act(() => result.current.dismissDiscoveredModels());
    expect(result.current.discoveredModelOptions).toEqual([]);
    expect(mocks.updateProvider).not.toHaveBeenCalled();
  });
});
