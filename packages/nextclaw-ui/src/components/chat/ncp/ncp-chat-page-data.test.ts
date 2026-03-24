import { describe, expect, it } from 'vitest';
import { filterModelOptionsBySessionType } from '@/components/chat/ncp/ncp-chat-page-data';
import type { ChatModelOption } from '@/components/chat/chat-input.types';

const modelOptions: ChatModelOption[] = [
  {
    value: 'dashscope/qwen3-coder-next',
    modelLabel: 'qwen3-coder-next',
    providerLabel: 'DashScope'
  },
  {
    value: 'anthropic/claude-sonnet-4-5',
    modelLabel: 'claude-sonnet-4-5',
    providerLabel: 'Anthropic'
  }
];

describe('filterModelOptionsBySessionType', () => {
  it('keeps the full model catalog when the session type does not publish a supportedModels whitelist', () => {
    expect(
      filterModelOptionsBySessionType({
        modelOptions
      })
    ).toEqual(modelOptions);
  });

  it('keeps only session-type-supported models when the runtime publishes a filtered list', () => {
    expect(
      filterModelOptionsBySessionType({
        modelOptions,
        supportedModels: ['dashscope/qwen3-coder-next']
      })
    ).toEqual([modelOptions[0]]);
  });

  it('falls back to the full model catalog when the advertised models do not match the current catalog', () => {
    expect(
      filterModelOptionsBySessionType({
        modelOptions,
        supportedModels: ['unknown/model']
      })
    ).toEqual(modelOptions);
  });
});
