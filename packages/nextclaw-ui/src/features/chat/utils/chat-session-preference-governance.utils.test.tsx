import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';
import { useSyncSelectedModel } from '@/features/chat/utils/chat-session-preference-governance.utils';

const modelOptions: ChatModelOption[] = [
  {
    value: 'minimax/MiniMax-M2.7',
    modelLabel: 'MiniMax-M2.7',
    providerLabel: 'MiniMax',
    thinkingCapability: null
  },
  {
    value: 'deepseek/deepseek-v4-flash',
    modelLabel: 'deepseek-v4-flash',
    providerLabel: 'DeepSeek',
    thinkingCapability: null
  },
  {
    value: 'openai/gpt-5',
    modelLabel: 'gpt-5',
    providerLabel: 'OpenAI',
    thinkingCapability: null
  }
];

type HookProps = {
  fallbackPreferredModel?: string;
  defaultModel: string;
};

describe('useSyncSelectedModel', () => {
  it('replaces an auto-selected global default with the later-arriving recent same-runtime model for a fresh draft session', async () => {
    const initialProps: HookProps = {
      fallbackPreferredModel: undefined,
      defaultModel: 'minimax/MiniMax-M2.7'
    };
    const { result, rerender } = renderHook(
      (props: HookProps) => {
        const [selectedModel, setSelectedModel] = useState('');
        useSyncSelectedModel({
          modelOptions,
          selectedSessionKey: 'draft-session',
          selectedSessionExists: false,
          fallbackPreferredModel: props.fallbackPreferredModel,
          defaultModel: props.defaultModel,
          setSelectedModel
        });
        return selectedModel;
      },
      {
        initialProps
      }
    );

    await waitFor(() => {
      expect(result.current).toBe('minimax/MiniMax-M2.7');
    });

    rerender({
      fallbackPreferredModel: 'deepseek/deepseek-v4-flash',
      defaultModel: 'minimax/MiniMax-M2.7'
    });

    await waitFor(() => {
      expect(result.current).toBe('deepseek/deepseek-v4-flash');
    });
  });

  it('does not override a manual model selection when recent same-runtime model data arrives later', async () => {
    const initialProps: HookProps = {
      fallbackPreferredModel: undefined,
      defaultModel: 'minimax/MiniMax-M2.7'
    };
    const { result, rerender } = renderHook(
      (props: HookProps) => {
        const [selectedModel, setSelectedModel] = useState('');
        useSyncSelectedModel({
          modelOptions,
          selectedSessionKey: 'draft-session',
          selectedSessionExists: false,
          fallbackPreferredModel: props.fallbackPreferredModel,
          defaultModel: props.defaultModel,
          setSelectedModel
        });
        return {
          selectedModel,
          setSelectedModel
        };
      },
      {
        initialProps
      }
    );

    await waitFor(() => {
      expect(result.current.selectedModel).toBe('minimax/MiniMax-M2.7');
    });

    act(() => {
      result.current.setSelectedModel('openai/gpt-5');
    });

    rerender({
      fallbackPreferredModel: 'deepseek/deepseek-v4-flash',
      defaultModel: 'minimax/MiniMax-M2.7'
    });

    await waitFor(() => {
      expect(result.current.selectedModel).toBe('openai/gpt-5');
    });
  });
});
