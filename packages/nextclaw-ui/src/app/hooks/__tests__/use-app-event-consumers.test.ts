import { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eventKeys } from '@nextclaw/shared';
import { invalidateChangedServerPath, useAppEventConsumers } from '@/app/hooks/use-app-event-consumers';
import { useChatSessionListStore } from '@/features/chat';
import { nextclawClient } from '@/shared/lib/api';

beforeEach(() => {
  useChatSessionListStore.getState().clearSessionRunStatuses();
});

describe('server path realtime invalidation', () => {
  it('invalidates only the browse query for the changed directory', () => {
    const invalidateQueries = vi.fn();
    invalidateChangedServerPath(
      { invalidateQueries } as unknown as QueryClient,
      '/Users/peiwang/Projects/nextbot/src',
    );

    const request = invalidateQueries.mock.calls[0]?.[0] as {
      predicate: (query: { queryKey: readonly unknown[] }) => boolean;
    };
    expect(request.predicate({ queryKey: ['server-path-browse', '/Users/peiwang/Projects/nextbot/src', '', true] })).toBe(true);
    expect(request.predicate({ queryKey: ['server-path-browse', '/Users/peiwang/Projects/nextbot', '', true] })).toBe(false);
    expect(request.predicate({ queryKey: ['server-path-read', '/Users/peiwang/Projects/nextbot/src', ''] })).toBe(false);
  });
});

describe('session run status realtime projection', () => {
  it('keeps runtime status outside summaries and clears it on idle or delete', () => {
    const queryClient = new QueryClient();
    const { unmount } = renderHook(() => useAppEventConsumers(queryClient));

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.sessionRunStatus, {
        sessionKey: 'session-new',
        status: 'running',
      });
    });
    expect(useChatSessionListStore.getState().runningSessionKeys).toEqual(['session-new']);

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.sessionRunStatus, {
        sessionKey: 'session-new',
        status: 'idle',
      });
    });
    expect(useChatSessionListStore.getState().runningSessionKeys).toEqual([]);

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.sessionRunStatus, {
        sessionKey: 'session-new',
        status: 'running',
      });
      nextclawClient.eventBus.emit(eventKeys.sessionSummaryDelete, {
        sessionKey: 'session-new',
      });
    });
    expect(useChatSessionListStore.getState().runningSessionKeys).toEqual([]);
    unmount();
  });

  it('clears overlays and resyncs both session query shapes after reconnect', () => {
    const queryClient = new QueryClient();
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const { unmount } = renderHook(() => useAppEventConsumers(queryClient));

    act(() => {
      nextclawClient.eventBus.emit(eventKeys.sessionRunStatus, {
        sessionKey: 'session-running',
        status: 'running',
      });
      nextclawClient.eventBus.emit(eventKeys.connectionClose, {});
      nextclawClient.eventBus.emit(eventKeys.connectionOpen, {});
    });

    expect(useChatSessionListStore.getState().runningSessionKeys).toEqual([]);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['ncp-sessions'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['ncp-session-pages'] });
    unmount();
  });
});
