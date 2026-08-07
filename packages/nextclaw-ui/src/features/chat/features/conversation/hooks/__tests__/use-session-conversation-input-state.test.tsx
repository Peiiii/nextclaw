import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useSessionConversationInputState } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';
import type { ChatModelOption } from '@/features/chat/types/chat-input.types';

const MODEL_OPTIONS: ChatModelOption[] = [
  {
    value: 'deepseek/deepseek-v4-flash',
    modelLabel: 'DeepSeek V4 Flash',
    providerLabel: 'DeepSeek',
    thinkingCapability: null,
  },
  {
    value: 'minimax/MiniMax-M3',
    modelLabel: 'MiniMax M3',
    providerLabel: 'MiniMax',
    thinkingCapability: null,
  },
];

describe('useSessionConversationInputState session preferences', () => {
  beforeEach(() => {
    useChatThreadStore.getState().setSnapshot({ draftProjectRoot: null });
  });

  it('owns the initial routed prompt before the composer first renders', () => {
    const { result } = renderHook(() => useSessionConversationInputState('  每天整理项目风险  '));

    expect(result.current.inputSnapshot.text).toBe('每天整理项目风险');
    expect(result.current.inputSnapshot.nodes).not.toHaveLength(0);
    expect(result.current.inputSnapshot.composerFocusRequestId).toBe(1);
  });

  it('restores the switched session model after its metadata becomes available', () => {
    const { result } = renderHook(() => useSessionConversationInputState());

    act(() => {
      result.current.inputActions.syncSessionPreferences({
        modelOptions: MODEL_OPTIONS,
        selectedSessionExists: true,
        selectedSessionKey: 'session-a',
        selectedSessionType: 'native',
        selectedSessionPreferredModel: 'deepseek/deepseek-v4-flash',
      });
    });
    expect(result.current.inputSnapshot.selectedModel).toBe('deepseek/deepseek-v4-flash');

    act(() => {
      result.current.inputActions.syncSessionPreferences({
        modelOptions: MODEL_OPTIONS,
        selectedSessionExists: false,
        selectedSessionKey: 'session-b',
        selectedSessionType: 'native',
      });
    });
    expect(result.current.inputSnapshot.selectedModel).toBe('deepseek/deepseek-v4-flash');

    act(() => {
      result.current.inputActions.syncSessionPreferences({
        modelOptions: MODEL_OPTIONS,
        selectedSessionExists: true,
        selectedSessionKey: 'session-b',
        selectedSessionType: 'native',
        selectedSessionPreferredModel: 'minimax/MiniMax-M3',
      });
    });
    expect(result.current.inputSnapshot.selectedModel).toBe('minimax/MiniMax-M3');
  });

  it('prefers the runtime recent model and otherwise restores the runtime default in a draft', () => {
    const { result } = renderHook(() => useSessionConversationInputState());

    act(() => {
      result.current.inputActions.syncSessionPreferences({
        fallbackPreferredModel: 'deepseek/deepseek-v4-flash',
        modelOptions: MODEL_OPTIONS,
        selectedSessionExists: false,
        selectedSessionKey: null,
        selectedSessionType: 'native',
      });
    });
    expect(result.current.inputSnapshot.selectedModel).toBe('deepseek/deepseek-v4-flash');

    act(() => {
      result.current.inputActions.syncSessionPreferences({
        defaultModel: 'deepseek/deepseek-v4-flash',
        fallbackPreferredModel: 'minimax/MiniMax-M3',
        modelOptions: MODEL_OPTIONS,
        selectedSessionExists: false,
        selectedSessionKey: null,
        selectedSessionType: 'codex',
      });
    });
    expect(result.current.inputSnapshot.selectedModel).toBe('minimax/MiniMax-M3');

    act(() => {
      result.current.inputActions.syncSessionPreferences({
        defaultModel: 'deepseek/deepseek-v4-flash',
        modelOptions: MODEL_OPTIONS,
        selectedSessionExists: false,
        selectedSessionKey: null,
        selectedSessionType: 'hermes',
      });
    });
    expect(result.current.inputSnapshot.selectedModel).toBe('deepseek/deepseek-v4-flash');
  });

  it('shares the selected draft project with the thread workspace owner', () => {
    const { result } = renderHook(() => useSessionConversationInputState());

    act(() => {
      result.current.inputActions.setPendingProjectRoot('/tmp/project-alpha');
    });

    expect(result.current.inputSnapshot.pendingProjectRoot).toBe('/tmp/project-alpha');
    expect(useChatThreadStore.getState().snapshot.draftProjectRoot).toBe('/tmp/project-alpha');
  });
});
