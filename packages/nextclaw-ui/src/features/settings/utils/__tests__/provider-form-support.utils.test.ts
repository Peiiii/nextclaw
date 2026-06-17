import { describe, expect, it } from 'vitest';
import {
  buildProviderSavePayload,
  resolveEditableModels,
  serializeModelsForSave
} from '@/features/settings/utils/provider-form-support.utils';
import {
  addProviderLocalModel,
  setModelThinkingDefaultInConfig,
  toggleModelThinkingLevelInConfig
} from '@/features/settings/utils/provider-form-model.utils';

describe('provider form model defaults', () => {
  it('keeps persisted empty models empty', () => {
    expect(resolveEditableModels(['gpt-5.5', 'gpt-5.4'], [])).toEqual([]);
  });

  it('keeps a non-empty saved override without resurrecting removed defaults', () => {
    expect(resolveEditableModels(['deepseek-chat', 'deepseek-reasoner'], ['deepseek-chat'])).toEqual([
      'deepseek-chat'
    ]);
  });

  it('serializes local model ids with the providerId prefix', () => {
    expect(serializeModelsForSave(['gpt-5.5', 'openai-work/gpt-5.4'], 'openai-work')).toEqual([
      'openai-work/gpt-5.5',
      'openai-work/gpt-5.4'
    ]);
  });

  it('builds a minimal save payload from changed provider fields', () => {
    expect(buildProviderSavePayload({
      providerName: 'openai-work',
      apiKey: ' sk-test ',
      apiBase: 'https://api.openai.com/v1',
      currentApiBase: 'https://old.example.com',
      defaultApiBase: 'https://api.openai.com/v1',
      extraHeaders: { ' X-Team ': 'nextclaw' },
      currentHeaders: null,
      supportsWireApi: true,
      wireApi: 'responses',
      currentWireApi: 'auto',
      models: ['gpt-5.5'],
      currentEditableModels: [],
      modelConfig: { 'gpt-5.5': { thinking: { supported: ['high'], default: 'high' } } },
      currentModelConfig: {},
      providerDisplayName: ' OpenAI Work ',
      effectiveDisplayName: 'OpenAI'
    })).toEqual({
      apiKey: 'sk-test',
      apiBase: null,
      displayName: 'OpenAI Work',
      extraHeaders: { 'X-Team': 'nextclaw' },
      wireApi: 'responses',
      models: ['openai-work/gpt-5.5'],
      modelConfig: { 'gpt-5.5': { thinking: { supported: ['high'], default: 'high' } } }
    });
  });

  it('adds local model drafts without accepting provider prefixes', () => {
    expect(addProviderLocalModel([], ' gpt-5.5 ', ['openai-work'])).toEqual({
      models: ['gpt-5.5'],
      draft: ''
    });
    expect(addProviderLocalModel([], ' other/gpt-5.5 ', ['openai-work'])).toEqual({
      models: [],
      draft: ' other/gpt-5.5 ',
      errorKey: 'providerModelInvalidProviderPrefix'
    });
  });

  it('keeps model thinking defaults inside the supported level set', () => {
    const config = toggleModelThinkingLevelInConfig({}, 'gpt-5.5', 'high');

    expect(setModelThinkingDefaultInConfig(config, 'gpt-5.5', 'high')).toEqual({
      'gpt-5.5': { thinking: { supported: ['high'], default: 'high' } }
    });
    expect(setModelThinkingDefaultInConfig(config, 'gpt-5.5', 'low')).toBe(config);
  });
});
