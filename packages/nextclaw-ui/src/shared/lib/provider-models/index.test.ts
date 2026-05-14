import { describe, expect, it } from 'vitest';
import { buildProviderModelCatalog } from './index';

describe('buildProviderModelCatalog', () => {
  it('does not resurrect an OpenRouter model removed from config models', () => {
    const catalog = buildProviderModelCatalog({
      onlyConfigured: true,
      meta: {
        providers: [
          {
            name: 'openrouter',
            displayName: 'OpenRouter',
            modelPrefix: 'openrouter',
            defaultModels: [
              'openrouter/deepseek/deepseek-v3.2',
              'openrouter/openai/gpt-5.3-codex'
            ],
            keywords: [],
            envKey: 'OPENROUTER_API_KEY'
          }
        ],
        search: [],
        channels: []
      },
      config: {
        providers: {
          openrouter: {
            enabled: true,
            apiKeySet: true,
            models: ['openai/gpt-5.3-codex']
          }
        }
      } as never
    });

    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.models).toEqual(['openai/gpt-5.3-codex']);
  });
});
