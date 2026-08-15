import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionConversationPreferencePersistence } from '@/features/chat/features/conversation/hooks/use-session-conversation-preference-persistence';
import type { SessionConversationInputActions } from '@/features/chat/features/conversation/hooks/use-session-conversation-input-state';

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
}));

vi.mock('@/features/chat/features/session/hooks/use-chat-session-update', () => ({
  useChatSessionUpdate: () => mocks.updateSession,
}));

function createInputActions() {
  return {
    update: vi.fn(),
  } as unknown as SessionConversationInputActions;
}

describe('useSessionConversationPreferencePersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSession.mockResolvedValue(undefined);
  });

  it('persists explicit off for a selected session without a success toast', async () => {
    const inputActions = createInputActions();
    const { result } = renderHook(() => useSessionConversationPreferencePersistence({
      inputActions,
      selectedSessionKey: 'session-1',
    }));

    act(() => result.current(
      { preferredThinking: 'off' },
      { selectedThinkingLevel: 'off' },
      { selectedThinkingLevel: 'high' },
    ));

    await waitFor(() => expect(mocks.updateSession).toHaveBeenCalledWith({
      invalidateSessionSkills: false,
      sessionKey: 'session-1',
      patch: { preferredThinking: 'off' },
      successMessage: null,
    }));
  });

  it('rolls back the latest failed thinking mutation only when it is still visible', async () => {
    mocks.updateSession.mockRejectedValueOnce(new Error('save failed'));
    const inputActions = createInputActions();
    const { result } = renderHook(() => useSessionConversationPreferencePersistence({
      inputActions,
      selectedSessionKey: 'session-1',
    }));

    act(() => result.current(
      { preferredThinking: 'off' },
      { selectedThinkingLevel: 'off' },
      { selectedThinkingLevel: 'high' },
    ));

    await waitFor(() => expect(inputActions.update).toHaveBeenCalledOnce());
    const rollback = vi.mocked(inputActions.update).mock.calls[0]?.[0];
    expect(typeof rollback).toBe('function');
    expect((rollback as (current: never) => unknown)({
      selectedModel: 'openai/gpt-5.6',
      selectedThinkingLevel: 'off',
    } as never)).toEqual({ selectedThinkingLevel: 'high' });
  });

  it('rolls back a failed runtime-default model selection using its UI value', async () => {
    mocks.updateSession.mockRejectedValueOnce(new Error('save failed'));
    const inputActions = createInputActions();
    const { result } = renderHook(() => useSessionConversationPreferencePersistence({
      inputActions,
      selectedSessionKey: 'session-1',
    }));

    act(() => result.current(
      { preferredModel: null },
      { selectedModel: '__runtime_default__' },
      { selectedModel: 'openai/gpt-5.6' },
    ));

    await waitFor(() => expect(inputActions.update).toHaveBeenCalledOnce());
    const rollback = vi.mocked(inputActions.update).mock.calls[0]?.[0];
    expect((rollback as (current: never) => unknown)({
      selectedModel: '__runtime_default__',
      selectedThinkingLevel: 'high',
    } as never)).toEqual({ selectedModel: 'openai/gpt-5.6' });
  });

  it('does not write a draft preference to a remote session', async () => {
    const inputActions = createInputActions();
    const { result } = renderHook(() => useSessionConversationPreferencePersistence({
      inputActions,
      selectedSessionKey: null,
    }));

    act(() => result.current(
      { preferredThinking: 'off' },
      { selectedThinkingLevel: 'off' },
      { selectedThinkingLevel: 'high' },
    ));
    await Promise.resolve();

    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(inputActions.update).not.toHaveBeenCalled();
  });
});
