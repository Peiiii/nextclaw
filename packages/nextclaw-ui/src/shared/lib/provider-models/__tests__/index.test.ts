import { describe, expect, it } from 'vitest';
import { buildProviderModelCatalog } from '../index';

describe('buildProviderModelCatalog', () => {
  it('keeps empty provider models empty', () => {
    const catalog = buildProviderModelCatalog({
      onlyConfigured: false,
      providersView: {
        providers: {
          openai: {
            providerId: 'openai',
            providerType: 'openai',
            isBuiltInType: true,
            isCustom: false,
            enabled: true,
            apiKeySet: true,
            models: []
          }
        }
      },
      templatesView: {
        providerTemplates: [
          {
            id: 'openai',
            providerType: 'openai',
            displayName: 'OpenAI',
            modelPrefix: 'openai',
            defaultModels: ['openai/gpt-5.5', 'openai/gpt-5.4'],
            keywords: [],
            envKey: 'OPENAI_API_KEY'
          }
        ],
      }
    });

    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.models).toEqual([]);
  });

  it('keeps builtin modelConfig when a configured provider has an empty persisted modelConfig', () => {
    const catalog = buildProviderModelCatalog({
      onlyConfigured: true,
      providersView: {
        providers: {
          gemini: {
            providerId: 'gemini',
            providerType: 'gemini',
            isBuiltInType: true,
            isCustom: false,
            enabled: true,
            apiKeySet: true,
            models: ['gemini/gemini-3.1-pro-preview'],
            modelConfig: {}
          }
        }
      },
      templatesView: {
        providerTemplates: [
          {
            id: 'gemini',
            providerType: 'gemini',
            displayName: 'Gemini',
            modelPrefix: 'gemini',
            defaultModels: ['gemini/gemini-3.1-pro-preview'],
            modelConfig: {
              'gemini/gemini-3.1-pro-preview': { vision: true }
            },
            keywords: [],
            envKey: 'GEMINI_API_KEY'
          }
        ],
      }
    });

    expect(catalog[0]?.modelConfig).toEqual({
      'gemini-3.1-pro-preview': { vision: true }
    });
  });

  it('does not resurrect an OpenRouter model removed from config models', () => {
    const catalog = buildProviderModelCatalog({
      onlyConfigured: true,
      providersView: {
        providers: {
          openrouter: {
            providerId: 'openrouter',
            providerType: 'openrouter',
            isBuiltInType: true,
            isCustom: false,
            enabled: true,
            apiKeySet: true,
            models: ['openrouter/openai/gpt-5.3-codex']
          }
        }
      },
      templatesView: {
        providerTemplates: [
          {
            id: 'openrouter',
            providerType: 'openrouter',
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
      }
    });

    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.models).toEqual(['openai/gpt-5.3-codex']);
  });
});
