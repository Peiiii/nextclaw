import type { PropsWithChildren } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { fetchNcpSessions } from '@/shared/lib/api';
import { useInfiniteNcpSessions } from '@/features/chat/features/ncp/hooks/use-ncp-session-queries';

vi.mock('@/shared/lib/api', () => ({ fetchNcpSessions: vi.fn() }));

it('isolates scheduled pages and restarts pagination when scope or search changes', async () => {
  vi.mocked(fetchNcpSessions).mockImplementation(async ({ query, scheduledOnly, page } = {}) => ({
    sessions: query ? [] : [{ sessionId: `${scheduledOnly ? 'scheduled' : 'ordinary'}-${page}`,
      messageCount: 0, updatedAt: '2026-10-02', status: 'idle',
    }], total: query ? 0 : 2, page: page ?? 1, pageSize: 1, hasMore: !query && page === 1,
  }));
  const client = new QueryClient();
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  const { result, rerender, unmount } = renderHook(
    ({ scheduledOnly, query }: { scheduledOnly: boolean; query: string }) => useInfiniteNcpSessions({ pageSize: 1, scheduledOnly, query }),
    { wrapper: Wrapper, initialProps: { scheduledOnly: false, query: '' } },
  );
  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isFetching).toBe(false);
    expect(result.current.hasNextPage).toBe(true);
  });
  await act(async () => { await result.current.fetchNextPage(); });
  await waitFor(() => expect(result.current.data?.pages.flatMap(p => p.sessions.map(s => s.sessionId))).toEqual(['ordinary-1', 'ordinary-2']));
  rerender({ scheduledOnly: true, query: '' });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(fetchNcpSessions).toHaveBeenLastCalledWith({ page: 1, pageSize: 1, scheduledOnly: true });
  expect(result.current.data?.pages.flatMap(p => p.sessions.map(s => s.sessionId))).toEqual(['scheduled-1']);
  await act(async () => { await result.current.fetchNextPage(); });
  await waitFor(() => expect(result.current.data?.pageParams).toEqual([1, 2]));
  rerender({ scheduledOnly: true, query: ' no-match ' });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(fetchNcpSessions).toHaveBeenLastCalledWith({ page: 1, pageSize: 1, scheduledOnly: true, query: 'no-match' });
  expect(result.current.data?.pages[0]?.sessions).toEqual([]);
  expect(result.current.hasNextPage).toBe(false);
  unmount(); client.clear();
});
