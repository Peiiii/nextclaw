import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  eventKeys,
  type UiNcpSessionPendingInputView,
  type UiNcpSessionPendingInputsView,
  type UiNcpSessionQueuedInputView,
} from '@nextclaw/client-sdk';

import { useSessionRunQueue } from '@/features/chat/features/conversation/hooks/use-session-run-queue';
import { nextclawClient } from '@/shared/lib/api';

function createQueue(sessionId: string, text: string): UiNcpSessionPendingInputsView {
  return {
    sessionId,
    inputs: [{
      id: `queued-${sessionId}`,
  sessionId,
  enqueuedAt: '2026-07-22T10:00:00.000Z',
      metadata: {},
      placement: 'queued',
      intendedRunId: null,
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
    vi.spyOn(nextclawClient.sessions, 'listPendingInputs').mockImplementation(async (sessionId) =>
      createQueue(sessionId, sessionId === 'session-1' ? 'first session' : 'second session'),
    );
    const { result, rerender } = renderHook(
      ({ sessionKey }) => useSessionRunQueue(sessionKey),
      { initialProps: { sessionKey: 'session-1' }, wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.inputs[0]?.message.parts[0]).toMatchObject({ text: 'first session' }));
    rerender({ sessionKey: 'session-2' });
    await waitFor(() => expect(result.current.inputs[0]?.message.parts[0]).toMatchObject({ text: 'second session' }));
    expect(nextclawClient.sessions.listPendingInputs).toHaveBeenCalledWith('session-1');
    expect(nextclawClient.sessions.listPendingInputs).toHaveBeenCalledWith('session-2');
  });

  it('refetches only when the matching session queue changes', async () => {
    const listPendingInputs = vi.spyOn(nextclawClient.sessions, 'listPendingInputs')
      .mockResolvedValue(createQueue('session-1', 'queued'));
    const { unmount } = renderHook(
      () => useSessionRunQueue('session-1'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(listPendingInputs).toHaveBeenCalledTimes(1));

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.sessionRunQueueUpdated, {
        sessionKey: 'session-2',
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(listPendingInputs).toHaveBeenCalledTimes(1);

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.sessionRunQueueUpdated, {
        sessionKey: 'session-1',
      });
    });
    await waitFor(() => expect(listPendingInputs).toHaveBeenCalledTimes(2));
    unmount();
  });

  it('refreshes the authoritative queue on demand after a submission is accepted', async () => {
    const listPendingInputs = vi.spyOn(nextclawClient.sessions, 'listPendingInputs')
      .mockResolvedValue(createQueue('session-1', 'queued'));
    const { result } = renderHook(
      () => useSessionRunQueue('session-1'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(listPendingInputs).toHaveBeenCalledTimes(1));

    let refreshed: UiNcpSessionQueuedInputView[] = [];
    await act(async () => {
      refreshed = [...await result.current.refreshQueuedInputs()];
    });

    expect(listPendingInputs).toHaveBeenCalledTimes(2);
    expect(refreshed[0]?.message.parts[0]).toMatchObject({ text: 'queued' });
  });

  it('refreshes steering inputs without filtering them out of the pending snapshot', async () => {
    const steeringQueue: UiNcpSessionPendingInputsView = {
      ...createQueue('session-1', 'change direction'),
      inputs: [{
        ...createQueue('session-1', 'change direction').inputs[0]!,
        intendedRunId: 'run-1',
        placement: 'steering',
      }],
    };
    vi.spyOn(nextclawClient.sessions, 'listPendingInputs').mockResolvedValue(steeringQueue);
    const { result } = renderHook(
      () => useSessionRunQueue('session-1'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.pendingInputs).toHaveLength(1));
    let refreshed: readonly UiNcpSessionPendingInputView[] = [];
    await act(async () => {
      refreshed = await result.current.refreshPendingInputs();
    });

    expect(refreshed).toMatchObject([{ placement: 'steering', intendedRunId: 'run-1' }]);
    expect(result.current.inputs).toEqual([]);
  });

  it('replaces an in-flight stale queue read after the queue changes', async () => {
    let resolveInitialRead!: (queue: UiNcpSessionPendingInputsView) => void;
    const initialRead = new Promise<UiNcpSessionPendingInputsView>((resolve) => {
      resolveInitialRead = resolve;
    });
    const listPendingInputs = vi.spyOn(nextclawClient.sessions, 'listPendingInputs')
      .mockImplementationOnce(async () => await initialRead)
      .mockResolvedValue({ sessionId: 'session-1', inputs: [] });
    const { result } = renderHook(
      () => useSessionRunQueue('session-1'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(listPendingInputs).toHaveBeenCalledTimes(1));

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.sessionRunQueueUpdated, {
        sessionKey: 'session-1',
      });
    });
    await waitFor(() => expect(listPendingInputs).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveInitialRead(createQueue('session-1', 'stale queued input'));
      await initialRead;
    });
    await waitFor(() => expect(result.current.inputs).toEqual([]));
  });
});
