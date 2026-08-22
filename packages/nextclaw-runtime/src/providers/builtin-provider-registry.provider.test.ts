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

  it('exposes OpenCode Zen anonymous free-trial defaults', async () => {
    const runtime = await import('./builtin-provider-registry.provider.js');

    const opencode = runtime.findBuiltinProviderByName('opencode');

    assert.equal(opencode?.defaultApiBase, 'https://opencode.ai/zen/v1');
    assert.equal(opencode?.anonymousApiKey, 'public');
    assert.equal(opencode?.defaultWireApi, 'chat');
    assert.equal(opencode?.supportsResponsesApi, false);
    assert.deepEqual(opencode?.defaultModels, [
      'opencode/big-pickle',
      'opencode/deepseek-v4-flash-free',
      'opencode/mimo-v2.5-free',
      'opencode/laguna-s-2.1-free',
      'opencode/longcat-2.0-free',
      'opencode/north-mini-code-free',
      'opencode/nemotron-3-ultra-free'
    ]);
  });

  it('declares the DeepSeek chat-completions thinking control', async () => {
    const runtime = await import('./builtin-provider-registry.provider.js');

    const deepseek = runtime.findBuiltinProviderByName('deepseek');

    assert.equal(deepseek?.chatCompletionsThinkingControl, 'thinking-type');
  });
});
