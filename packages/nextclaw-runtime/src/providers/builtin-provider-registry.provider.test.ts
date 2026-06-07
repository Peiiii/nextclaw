import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { configureProviderCatalog, listProviderSpecs } from '@nextclaw/core';

describe('@nextclaw/runtime module boundary', () => {
  it('keeps builtin providers local to runtime', async () => {
    configureProviderCatalog([]);

    const runtime = await import('./builtin-provider-registry.provider.js');

    assert.ok(runtime.builtinProviderIds().length > 0);
    assert.deepEqual(listProviderSpecs(), []);
  });

  it('exposes xiaomi mimo defaults and vision capability', async () => {
    const runtime = await import('./builtin-provider-registry.provider.js');

    const mimo = runtime.findBuiltinProviderByName('mimo');

    assert.equal(mimo?.defaultApiBase, 'https://api.xiaomimimo.com/v1');
    assert.deepEqual(mimo?.defaultModels, ['mimo/mimo-v2.5-pro', 'mimo/mimo-v2.5']);
    assert.deepEqual(mimo?.modelConfig, {
      'mimo/mimo-v2.5': { vision: true }
    });
  });
});
