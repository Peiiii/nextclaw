import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProvidersList } from '@/components/config/ProvidersList';

const mocks = vi.hoisted(() => ({
  createProviderMutateAsync: vi.fn(),
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

vi.mock('@/hooks/useConfig', () => ({
  useConfig: () => mocks.configQuery,
  useConfigMeta: () => mocks.metaQuery,
  useConfigSchema: () => mocks.schemaQuery,
  useCreateProvider: () => ({
    mutateAsync: mocks.createProviderMutateAsync,
    isPending: false,
  }),
}));

vi.mock('@/components/config/ProviderForm', () => ({
  ProviderForm: ({ providerName }: { providerName?: string }) => (
    <div data-testid="provider-form">{providerName ?? 'none'}</div>
  ),
}));

describe('ProvidersList', () => {
  it('keeps the nextclaw builtin provider at the end of the list', () => {
    const { container } = render(<ProvidersList />);

    const sidebarSection = container.querySelector('section');
    if (!(sidebarSection instanceof HTMLElement)) {
      throw new Error('provider sidebar not found');
    }

    const providerButtons = Array.from(sidebarSection.querySelectorAll('button[type="button"]')).filter((button) =>
      ['OpenAI', 'Anthropic', 'NextClaw Builtin'].some((label) => button.textContent?.includes(label)),
    );

    expect(providerButtons.map((button) => button.textContent)).toEqual([
      expect.stringContaining('OpenAI'),
      expect.stringContaining('Anthropic'),
      expect.stringContaining('NextClaw Builtin'),
    ]);
  });
});
