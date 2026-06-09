import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProvidersConfigPage } from '@/features/settings/pages/providers-config-page';

const mocks = vi.hoisted(() => ({
  createProviderMutateAsync: vi.fn(),
  deleteProviderMutate: vi.fn(),
  updateProviderMutate: vi.fn(),
  configQuery: {
    data: {
      providers: {
        openai: { enabled: true, apiKeySet: true },
        anthropic: { enabled: true, apiKeySet: true },
        nextclaw: { enabled: true, apiKeySet: true },
      },
    },
    isLoading: false,
  },
  metaQuery: {
    data: {
      providers: [
        { name: 'nextclaw', displayName: 'NextClaw Builtin', defaultApiBase: 'https://ai-gateway-api.nextclaw.io/v1' },
        { name: 'openai', displayName: 'OpenAI', defaultApiBase: 'https://api.openai.com/v1' },
        { name: 'anthropic', displayName: 'Anthropic', defaultApiBase: 'https://api.anthropic.com/v1' },
      ],
    },
  },
  schemaQuery: {
    data: {
      uiHints: {},
    },
  },
}));

vi.mock('@/shared/hooks/use-config', () => ({
  useConfig: () => mocks.configQuery,
  useConfigMeta: () => mocks.metaQuery,
  useProviders: () => ({
    data: {
      providers: Object.fromEntries(
        Object.entries(mocks.configQuery.data.providers).map(([providerId, provider]) => [
          providerId,
          {
            providerId,
            providerType: providerId,
            isBuiltInType: providerId === 'nextclaw',
            isCustom: false,
            enabled: provider.enabled,
            apiKeySet: provider.apiKeySet,
          },
        ]),
      ),
    },
    isFetched: true,
    isSuccess: true,
  }),
  useProviderTemplates: () => ({
    data: {
      providerTemplates: mocks.metaQuery.data.providers.map((provider) => ({
        id: provider.name,
        providerType: provider.name,
        displayName: provider.displayName,
        defaultApiBase: provider.defaultApiBase,
        keywords: [],
        envKey: '',
      })),
    },
    isFetched: true,
    isSuccess: true,
  }),
  useConfigSchema: () => mocks.schemaQuery,
  useCreateProvider: () => ({
    mutateAsync: mocks.createProviderMutateAsync,
    isPending: false,
  }),
  useDeleteProvider: () => ({
    mutate: mocks.deleteProviderMutate,
    isPending: false,
  }),
  useUpdateProvider: () => ({
    mutate: mocks.updateProviderMutate,
    isPending: false,
  }),
}));

vi.mock('@/features/settings/components/config/provider-form', () => ({
  ProviderForm: ({ providerName }: { providerName?: string }) => (
    <div data-testid="provider-form">{providerName ?? 'none'}</div>
  ),
}));

describe('ProvidersConfigPage', () => {
  it('keeps the nextclaw builtin provider at the end of the list', () => {
    const { container } = render(<ProvidersConfigPage />);

    const sidebarSection = container.querySelector('section');
    if (!(sidebarSection instanceof HTMLElement)) {
      throw new Error('provider sidebar not found');
    }

    const providerButtons = Array.from(sidebarSection.querySelectorAll('[role="button"]')).filter((button) =>
      ['OpenAI', 'Anthropic', 'NextClaw Builtin'].some((label) => button.textContent?.includes(label)),
    );

    expect(providerButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining('OpenAI'),
      expect.stringContaining('Anthropic'),
      expect.stringContaining('NextClaw Builtin'),
    ]);
  });
});
