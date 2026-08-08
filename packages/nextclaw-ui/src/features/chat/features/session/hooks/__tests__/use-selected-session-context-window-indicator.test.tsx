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
        completeInputBudget: true,
        usedContextTokens: 25,
        totalContextTokens: 100,
        fixedInputTokens: 10,
        dynamicInputTokens: 15,
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

  it('shows pressure against the compaction threshold and exposes the full input breakdown', () => {
    useChatThreadStore.getState().setSnapshot({
      sessionKey: 'session-current',
      contextWindow: {
        completeInputBudget: true,
        usedContextTokens: 28_000,
        totalContextTokens: 35_000,
        fixedInputTokens: 25_000,
        dynamicInputTokens: 3_000,
        reservedContextTokens: 7_000,
        triggerContextTokens: 28_000,
        availableBeforeCompactionTokens: 0,
        availableContextTokens: 7_000,
        prunedUsedContextTokens: 28_000,
        droppedHistoryCount: 0,
        truncatedToolResultCount: 0,
        truncatedSystemPrompt: false,
        truncatedUserMessage: false,
        compacted: false,
        compactedMessageCount: 0,
        updatedAt: '2026-08-08T00:00:00.000Z',
      },
    });

    const { result } = renderHook(() =>
      useSelectedSessionContextWindowIndicator(),
    );

    expect(result.current).toMatchObject({
      percentLabel: '100%',
      ratio: 1,
      tone: 'danger',
    });
    expect(result.current?.details.map((detail) => detail.value)).toEqual([
      '28k',
      '28k',
      '0',
      '25k',
      '3.0k',
      '7.0k',
      '35k',
    ]);
    expect(result.current?.details.map((detail) => detail.dividerBefore ?? false)).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
      false,
    ]);
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

  it('hides history-only snapshots instead of presenting missing fixed input as zero', () => {
    useChatThreadStore.getState().setSnapshot({
      sessionKey: 'session-current',
      contextWindow: {
        completeInputBudget: true,
        usedContextTokens: 5,
        totalContextTokens: 35_000,
        fixedInputTokens: 0,
        dynamicInputTokens: 5,
        reservedContextTokens: 7_000,
        triggerContextTokens: 28_000,
        availableBeforeCompactionTokens: 27_995,
        availableContextTokens: 34_995,
        prunedUsedContextTokens: 5,
        droppedHistoryCount: 0,
        truncatedToolResultCount: 0,
        truncatedSystemPrompt: false,
        truncatedUserMessage: false,
        compacted: false,
        compactedMessageCount: 0,
        updatedAt: '2026-08-08T00:00:00.000Z',
      },
    });

    const { result } = renderHook(() =>
      useSelectedSessionContextWindowIndicator(),
    );

    expect(result.current).toBeNull();
  });
});
