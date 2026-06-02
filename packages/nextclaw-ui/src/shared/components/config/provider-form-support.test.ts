import { describe, expect, it } from 'vitest';
import { resolveEditableModels, serializeModelsForSave } from './provider-form-support';

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
});
