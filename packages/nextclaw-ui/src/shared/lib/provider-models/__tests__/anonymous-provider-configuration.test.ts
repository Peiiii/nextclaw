import { describe, expect, it } from 'vitest';
import { buildProviderModelCatalog } from '@/shared/lib/provider-models';

describe('anonymous provider configuration', () => {
  it('includes an enabled provider that does not require a user API key', () => {
    const catalog = buildProviderModelCatalog({
      onlyConfigured: true,
      providersView: {
        providers: {
          opencode: {
            providerId: 'opencode',
            providerType: 'opencode',
            isBuiltInType: true,
            isCustom: false,
            enabled: true,
            apiKeyRequired: false,
            apiKeySet: false,
            models: ['opencode/big-pickle']
          }
        }
      },
      templatesView: {
        providerTemplates: [
          {
            id: 'opencode',
            providerType: 'opencode',
            displayName: 'OpenCode Zen Free Trial',
            modelPrefix: 'opencode',
            defaultModels: ['opencode/big-pickle'],
            keywords: ['opencode'],
            envKey: 'OPENCODE_API_KEY'
          }
        ]
      }
    });

    expect(catalog).toHaveLength(1);
    expect(catalog[0]?.models).toEqual(['big-pickle']);
  });
});
