import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useProviderConnectivity } from '@/features/settings/hooks/use-provider-connectivity';

const mocks = vi.hoisted(() => ({
  discoverModels: vi.fn(),
  testConnection: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/shared/hooks/use-config', () => ({
  useDiscoverProviderModels: () => ({ mutateAsync: mocks.discoverModels, isPending: false }),
  useTestProviderConnection: () => ({ mutateAsync: mocks.testConnection, isPending: false }),
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

describe('useProviderConnectivity', () => {
  beforeEach(() => {
    mocks.discoverModels.mockReset().mockResolvedValue({
      models: ['openrouter/gpt-5', 'openrouter/qwen/qwen3.8-max'],
      source: 'provider',
    });
    mocks.testConnection.mockReset();
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
  });

  it('fetches a catalog for selection without changing the provider model draft', async () => {
    const { result, rerender } = renderHook(
      ({ apiBase }) => useProviderConnectivity({
        providerName: 'openrouter',
        apiKey: 'secret',
        apiBase,
        extraHeaders: null,
        supportsWireApi: false,
        wireApi: 'auto',
        models: ['gpt-5'],
        providerModelAliases: ['openrouter'],
      }),
      { initialProps: { apiBase: 'https://openrouter.ai/api/v1' } },
    );

    let fetched: string[] | null = null;
    await act(async () => {
      fetched = await result.current.discoverModels();
    });

    expect(fetched).toEqual(['openrouter/gpt-5', 'openrouter/qwen/qwen3.8-max']);
    expect(result.current.fetchedModels).toEqual(fetched);
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Model list fetched');

    rerender({ apiBase: 'https://example.com/v1' });
    expect(result.current.fetchedModels).toEqual([]);
  });
});
