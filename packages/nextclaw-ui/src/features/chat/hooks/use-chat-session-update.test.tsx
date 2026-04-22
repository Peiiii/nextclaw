import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { useChatSessionUpdate } from '@/features/chat/hooks/use-chat-session-update';

const mocks = vi.hoisted(() => ({
  updateNcpSession: vi.fn(),
  upsertNcpSessionSummaryInQueryClient: vi.fn()
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/api')>();
  return {
    ...actual,
    updateNcpSession: (...args: unknown[]) => mocks.updateNcpSession(...args),
    upsertNcpSessionSummaryInQueryClient: (...args: unknown[]) =>
      mocks.upsertNcpSessionSummaryInQueryClient(...args)
  };
});

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useChatSessionUpdate', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates the session summary and invalidates the matching session skills queries', async () => {
    const queryClient = new QueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const updatedSession = {
      sessionId: 'session-1',
      updatedAt: '2026-04-09T00:00:00.000Z',
      status: 'idle',
      metadata: { project_root: '/tmp/project-alpha' }
    };
    mocks.updateNcpSession.mockResolvedValue(updatedSession);

    const { result } = renderHook(() => useChatSessionUpdate(), {
      wrapper: createWrapper(queryClient)
    });

    await act(async () => {
      await result.current({
        sessionKey: 'session-1',
        patch: { projectRoot: '/tmp/project-alpha' },
        successMessage: 'Project directory updated'
      });
    });

    expect(mocks.updateNcpSession).toHaveBeenCalledWith('session-1', {
      projectRoot: '/tmp/project-alpha'
    });
    expect(mocks.upsertNcpSessionSummaryInQueryClient).toHaveBeenCalledWith(queryClient, updatedSession);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['ncp-session-skills', 'session-1']
    });
    expect(toast.success).toHaveBeenCalledWith('Project directory updated');
  });
});
