import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { eventKeys, type UiNcpSessionQueuedInputsView } from '@nextclaw/client-sdk';

import { useSessionRunQueue } from '@/features/chat/features/conversation/hooks/use-session-run-queue';
import { nextclawClient } from '@/shared/lib/api';

function createQueue(sessionId: string, text: string): UiNcpSessionQueuedInputsView {
  return {
    sessionId,
    inputs: [{
      id: `queued-${sessionId}`,
  sessionId,
  enqueuedAt: '2026-07-22T10:00:00.000Z',
  metadata: {},
  message: {
        id: `message-${sessionId}`,
        sessionId,
        role: 'user',
        status: 'final',
        timestamp: '2026-07-22T10:00:00.000Z',
        parts: [{ type: 'text', text }],
      },
    }],
  };
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSessionRunQueue', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keys backend queue data by session instead of sharing one frontend queue', async () => {
    vi.spyOn(nextclawClient.sessions, 'listQueuedInputs').mockImplementation(async (sessionId) =>
      createQueue(sessionId, sessionId === 'session-1' ? 'first session' : 'second session'),
    );
    const { result, rerender } = renderHook(
      ({ sessionKey }) => useSessionRunQueue(sessionKey),
      { initialProps: { sessionKey: 'session-1' }, wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.inputs[0]?.message.parts[0]).toMatchObject({ text: 'first session' }));
    rerender({ sessionKey: 'session-2' });
    await waitFor(() => expect(result.current.inputs[0]?.message.parts[0]).toMatchObject({ text: 'second session' }));
    expect(nextclawClient.sessions.listQueuedInputs).toHaveBeenCalledWith('session-1');
    expect(nextclawClient.sessions.listQueuedInputs).toHaveBeenCalledWith('session-2');
  });

  it('refetches only when the matching session queue changes', async () => {
    const listQueuedInputs = vi.spyOn(nextclawClient.sessions, 'listQueuedInputs')
      .mockResolvedValue(createQueue('session-1', 'queued'));
    const { unmount } = renderHook(
      () => useSessionRunQueue('session-1'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(listQueuedInputs).toHaveBeenCalledTimes(1));

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.sessionRunQueueUpdated, {
        sessionKey: 'session-2',
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listQueuedInputs).toHaveBeenCalledTimes(1);

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.sessionRunQueueUpdated, {
        sessionKey: 'session-1',
      });
    });
    await waitFor(() => expect(listQueuedInputs).toHaveBeenCalledTimes(2));
    unmount();
  });
});
