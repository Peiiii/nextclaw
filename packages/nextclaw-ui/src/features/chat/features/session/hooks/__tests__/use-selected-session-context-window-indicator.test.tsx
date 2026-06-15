import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSelectedSessionContextWindowIndicator } from '@/features/chat/features/session/hooks/use-selected-session-context-window-indicator';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';

describe('useSelectedSessionContextWindowIndicator', () => {
  beforeEach(() => {
    useChatSessionListStore.getState().setSnapshot({
      selectedSessionKey: null,
    });
    useChatThreadStore.getState().setSnapshot({
      sessionKey: null,
      contextWindow: null,
    });
  });

  it('shows the current thread context window once the thread snapshot has it', () => {
    useChatSessionListStore.getState().setSnapshot({
      selectedSessionKey: 'session-other',
    });
    useChatThreadStore.getState().setSnapshot({
      sessionKey: 'session-current',
      contextWindow: {
        usedContextTokens: 25,
        totalContextTokens: 100,
        availableContextTokens: 75,
        prunedUsedContextTokens: 25,
        droppedHistoryCount: 0,
        truncatedToolResultCount: 0,
        truncatedSystemPrompt: false,
        truncatedUserMessage: false,
        compacted: false,
        compactedUsedContextTokens: 25,
        compactedMessageCount: 0,
        updatedAt: '2026-06-10T00:00:00.000Z',
      },
    });

    const { result } = renderHook(() =>
      useSelectedSessionContextWindowIndicator(),
    );

    expect(result.current).toMatchObject({
      percentLabel: '25%',
      ratio: 0.25,
      tone: 'neutral',
    });
  });

  it('hides the indicator when the current thread snapshot has no context window', () => {
    useChatThreadStore.getState().setSnapshot({
      sessionKey: 'session-current',
      contextWindow: null,
    });

    const { result } = renderHook(() =>
      useSelectedSessionContextWindowIndicator(),
    );

    expect(result.current).toBeNull();
  });
});
