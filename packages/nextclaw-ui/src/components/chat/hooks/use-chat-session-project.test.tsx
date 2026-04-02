import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useChatSessionProject } from '@/components/chat/hooks/use-chat-session-project';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

vi.mock('@/components/chat/hooks/use-chat-session-update', () => ({
  useChatSessionUpdate: () => mocks.updateSession,
}));

describe('useChatSessionProject', () => {
  beforeEach(() => {
    useChatInputStore.setState((state) => ({
      snapshot: {
        ...state.snapshot,
        pendingProjectRoot: null,
        pendingProjectRootSessionKey: null,
      },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('stores the draft project root locally when the session does not exist yet', async () => {
    const { result } = renderHook(() => useChatSessionProject());

    await act(async () => {
      await result.current({
        sessionKey: 'draft-session-1',
        projectRoot: '/tmp/project-alpha',
        persistToServer: false,
      });
    });

    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(useChatInputStore.getState().snapshot).toMatchObject({
      pendingProjectRoot: '/tmp/project-alpha',
      pendingProjectRootSessionKey: 'draft-session-1',
    });
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('keeps an explicit draft override when clearing the project root locally', async () => {
    const { result } = renderHook(() => useChatSessionProject());

    await act(async () => {
      await result.current({
        sessionKey: 'draft-session-1',
        projectRoot: null,
        persistToServer: false,
      });
    });

    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(useChatInputStore.getState().snapshot).toMatchObject({
      pendingProjectRoot: null,
      pendingProjectRootSessionKey: 'draft-session-1',
    });
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('persists to the server and mirrors the updated project override locally for an existing session', async () => {
    const { result } = renderHook(() => useChatSessionProject());

    await act(async () => {
      await result.current({
        sessionKey: 'session-1',
        projectRoot: '/tmp/project-beta',
        persistToServer: true,
      });
    });

    expect(mocks.updateSession).toHaveBeenCalledWith({
      sessionKey: 'session-1',
      patch: { projectRoot: '/tmp/project-beta' },
      successMessage: 'Project directory updated',
    });
    expect(useChatInputStore.getState().snapshot).toMatchObject({
      pendingProjectRoot: '/tmp/project-beta',
      pendingProjectRootSessionKey: 'session-1',
    });
  });

  it('persists clearing to the server and keeps the cleared override until session state catches up', async () => {
    const { result } = renderHook(() => useChatSessionProject());

    await act(async () => {
      await result.current({
        sessionKey: 'session-1',
        projectRoot: null,
        persistToServer: true,
      });
    });

    expect(mocks.updateSession).toHaveBeenCalledWith({
      sessionKey: 'session-1',
      patch: { projectRoot: null },
      successMessage: 'Project directory cleared',
    });
    expect(useChatInputStore.getState().snapshot).toMatchObject({
      pendingProjectRoot: null,
      pendingProjectRootSessionKey: 'session-1',
    });
  });
});
