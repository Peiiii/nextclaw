import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useChatSessionProject } from '@/features/chat/features/session/hooks/use-chat-session-project';

const mocks = vi.hoisted(() => ({
  updateSession: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn()
  }
}));

vi.mock('@/features/chat/features/session/hooks/use-chat-session-update', () => ({
  useChatSessionUpdate: () => mocks.updateSession
}));

describe('useChatSessionProject', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not persist draft project root through the session update hook', async () => {
    const { result } = renderHook(() => useChatSessionProject());

    await act(async () => {
      await result.current({
        sessionKey: 'draft-session-1',
        projectRoot: '/tmp/project-alpha',
        persistToServer: false
      });
    });

    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('does not persist draft project clearing through the session update hook', async () => {
    const { result } = renderHook(() => useChatSessionProject());

    await act(async () => {
      await result.current({
        sessionKey: 'draft-session-1',
        projectRoot: null,
        persistToServer: false
      });
    });

    expect(mocks.updateSession).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('persists to the server without reusing the draft override state for an existing session', async () => {
    const { result } = renderHook(() => useChatSessionProject());

    await act(async () => {
      await result.current({
        sessionKey: 'session-1',
        projectRoot: '/tmp/project-beta',
        persistToServer: true
      });
    });

    expect(mocks.updateSession).toHaveBeenCalledWith({
      sessionKey: 'session-1',
      patch: { projectRoot: '/tmp/project-beta' },
      successMessage: 'Project directory updated'
    });
  });

  it('persists clearing to the server without keeping a session-scoped local override', async () => {
    const { result } = renderHook(() => useChatSessionProject());

    await act(async () => {
      await result.current({
        sessionKey: 'session-1',
        projectRoot: null,
        persistToServer: true
      });
    });

    expect(mocks.updateSession).toHaveBeenCalledWith({
      sessionKey: 'session-1',
      patch: { projectRoot: null },
      successMessage: 'Project directory cleared'
    });
  });
});
