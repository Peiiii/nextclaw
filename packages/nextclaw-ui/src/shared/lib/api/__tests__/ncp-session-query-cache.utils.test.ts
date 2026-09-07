import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  applyNcpSessionRealtimeEvent,
  deleteNcpSessionSummaryList,
  updateNcpSessionRunStatusList,
  upsertNcpSessionSummaryList
} from '@/shared/lib/api';
import type { NcpSessionsListView } from '@/shared/lib/api';

function createSessionsList(): NcpSessionsListView {
  return {
    sessions: [
      {
        sessionId: 'session-1',
        messageCount: 1,
        createdAt: '2026-03-29T08:00:00.000Z',
        updatedAt: '2026-03-29T10:00:00.000Z',
        lastMessageAt: '2026-03-29T10:00:00.000Z',
        status: 'idle',
        metadata: {}
      },
      {
        sessionId: 'session-2',
        messageCount: 2,
        createdAt: '2026-03-29T07:00:00.000Z',
        updatedAt: '2026-03-29T09:00:00.000Z',
        lastMessageAt: '2026-03-29T09:00:00.000Z',
        status: 'idle',
        metadata: {}
      }
    ],
    total: 2
  };
}

describe('ncp-session-query-cache', () => {
  it('upserts summaries and keeps the list sorted by last message time descending', () => {
    const updated = upsertNcpSessionSummaryList(createSessionsList(), {
      sessionId: 'session-2',
      messageCount: 3,
      createdAt: '2026-03-29T07:00:00.000Z',
      updatedAt: '2026-03-29T11:00:00.000Z',
      lastMessageAt: '2026-03-29T11:00:00.000Z',
      status: 'running',
      metadata: { label: 'Latest' }
    });

    expect(updated?.sessions.map((session) => session.sessionId)).toEqual(['session-2', 'session-1']);
    expect(updated?.sessions[0]).toMatchObject({
      sessionId: 'session-2',
      messageCount: 3,
      status: 'running'
    });
  });

  it('does not reorder when only session metadata updatedAt changes', () => {
    const updated = upsertNcpSessionSummaryList(createSessionsList(), {
      sessionId: 'session-2',
      messageCount: 2,
      createdAt: '2026-03-29T07:00:00.000Z',
      updatedAt: '2026-03-29T12:00:00.000Z',
      lastMessageAt: '2026-03-29T09:00:00.000Z',
      status: 'idle',
      metadata: { ui_last_read_at: '2026-03-29T09:00:00.000Z' }
    });

    expect(updated?.sessions.map((session) => session.sessionId)).toEqual(['session-1', 'session-2']);
    expect(updated?.sessions[1]?.metadata).toEqual({
      ui_last_read_at: '2026-03-29T09:00:00.000Z'
    });
  });

  it('ignores stale summaries that would move a session back to an older running state', () => {
    const updated = upsertNcpSessionSummaryList(createSessionsList(), {
      sessionId: 'session-1',
      messageCount: 9,
      updatedAt: '2026-03-29T09:00:00.000Z',
      status: 'running',
      metadata: { label: 'Stale running' }
    });

    expect(updated?.sessions[0]).toMatchObject({
      sessionId: 'session-1',
      messageCount: 1,
      status: 'idle'
    });
  });

  it('prefers idle over running when summaries arrive with the same timestamp', () => {
    const current = createSessionsList();
    current.sessions[0] = {
      ...current.sessions[0],
      updatedAt: '2026-03-29T10:00:00.000Z',
      status: 'idle'
    };

    const updated = upsertNcpSessionSummaryList(current, {
      sessionId: 'session-1',
      messageCount: 5,
      updatedAt: '2026-03-29T10:00:00.000Z',
      status: 'running',
      metadata: {}
    });

    expect(updated?.sessions[0]).toMatchObject({
      sessionId: 'session-1',
      messageCount: 1,
      status: 'idle'
    });
  });

  it('deletes summaries without mutating unrelated entries', () => {
    const updated = deleteNcpSessionSummaryList(createSessionsList(), 'session-1');

    expect(updated?.sessions.map((session) => session.sessionId)).toEqual(['session-2']);
    expect(updated?.total).toBe(1);
  });

  it('updates run status without changing message count or sort order', () => {
    const updated = updateNcpSessionRunStatusList(createSessionsList(), {
      sessionKey: 'session-2',
      status: 'running'
    });

    expect(updated?.sessions.map((session) => session.sessionId)).toEqual(['session-1', 'session-2']);
    expect(updated?.sessions[1]).toMatchObject({
      sessionId: 'session-2',
      messageCount: 2,
      status: 'running'
    });
  });

  it('keeps the realtime running overlay when a newer persisted idle summary arrives', () => {
    const current = updateNcpSessionRunStatusList(createSessionsList(), {
      sessionKey: 'session-1',
      status: 'running'
    });

    const updated = upsertNcpSessionSummaryList(current, {
      sessionId: 'session-1',
      messageCount: 2,
      createdAt: '2026-03-29T08:00:00.000Z',
      updatedAt: '2026-03-29T10:01:00.000Z',
      lastMessageAt: '2026-03-29T10:01:00.000Z',
      status: 'idle',
      metadata: { last_activity_preview: { state: 'running' } }
    });

    expect(updated?.sessions[0]).toMatchObject({
      sessionId: 'session-1',
      messageCount: 2,
      status: 'running'
    });
  });

  it.each(['cancelled', 'failed'] as const)(
    'clears a stale running overlay when a newer %s summary arrives',
    (state) => {
      const current = updateNcpSessionRunStatusList(createSessionsList(), {
        sessionKey: 'session-1',
        status: 'running'
      });

      const updated = upsertNcpSessionSummaryList(current, {
        sessionId: 'session-1',
        messageCount: 2,
        createdAt: '2026-03-29T08:00:00.000Z',
        updatedAt: '2026-03-29T10:01:00.000Z',
        lastMessageAt: '2026-03-29T10:01:00.000Z',
        status: 'idle',
        metadata: { last_activity_preview: { state } }
      });

      expect(updated?.sessions[0]).toMatchObject({
        sessionId: 'session-1',
        messageCount: 2,
        status: 'idle'
      });
    }
  );

  it('applies realtime upsert/delete events to every ncp-sessions query cache entry', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['ncp-sessions', 200], createSessionsList());
    queryClient.setQueryData(['ncp-session-token-usage', 'session-3'], { runCount: 1 });

    applyNcpSessionRealtimeEvent(queryClient, {
      type: 'session.run-status',
      payload: {
        sessionKey: 'session-1',
        status: 'running'
      }
    });

    expect(queryClient.getQueryData<NcpSessionsListView>(['ncp-sessions', 200])?.sessions[0]?.status).toBe('running');

    applyNcpSessionRealtimeEvent(queryClient, {
      type: 'session.summary.upsert',
      payload: {
        summary: {
          sessionId: 'session-3',
          messageCount: 1,
          createdAt: '2026-03-29T12:00:00.000Z',
          updatedAt: '2026-03-29T12:00:00.000Z',
          lastMessageAt: '2026-03-29T12:00:00.000Z',
          status: 'running',
          metadata: {}
        }
      }
    });

    expect(
      queryClient.getQueryData<NcpSessionsListView>(['ncp-sessions', 200])?.sessions.map((session) => session.sessionId)
    ).toEqual(['session-3', 'session-1', 'session-2']);
    expect(queryClient.getQueryState(['ncp-session-token-usage', 'session-3'])?.isInvalidated).toBe(true);

    applyNcpSessionRealtimeEvent(queryClient, {
      type: 'session.summary.delete',
      payload: {
        sessionKey: 'session-1'
      }
    });

    expect(
      queryClient.getQueryData<NcpSessionsListView>(['ncp-sessions', 200])?.sessions.map((session) => session.sessionId)
    ).toEqual(['session-3', 'session-2']);
  });

  it('does not upsert a peer summary into another peer filtered session cache', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['ncp-sessions', 200, 'peer-a'], {
      sessions: [],
      total: 0
    });
    queryClient.setQueryData(['ncp-sessions', 200, 'peer-b'], {
      sessions: [],
      total: 0
    });

    applyNcpSessionRealtimeEvent(queryClient, {
      type: 'session.summary.upsert',
      payload: {
        summary: {
          sessionId: 'session-peer-a',
          peerId: 'peer-a',
          messageCount: 1,
          updatedAt: '2026-03-29T12:00:00.000Z',
          status: 'idle'
        }
      }
    });

    expect(
      queryClient.getQueryData<NcpSessionsListView>(['ncp-sessions', 200, 'peer-a'])?.sessions
    ).toEqual([
      expect.objectContaining({
        peerId: 'peer-a',
        sessionId: 'session-peer-a'
      })
    ]);
    expect(queryClient.getQueryData<NcpSessionsListView>(['ncp-sessions', 200, 'peer-b'])?.sessions).toEqual([]);
  });
});

describe('paginated ncp session realtime cache', () => {
  it('updates existing paginated summaries without invalidating the session pages', () => {
    const queryClient = new QueryClient();
    const queryKey = ['ncp-session-pages', 1, null] as const;
    const current = createSessionsList();
    queryClient.setQueryData<InfiniteData<NcpSessionsListView>>(queryKey, {
      pages: [
        { ...current, sessions: [current.sessions[0]!], page: 1, pageSize: 1, hasMore: true },
        { ...current, sessions: [current.sessions[1]!], page: 2, pageSize: 1, hasMore: false }
      ],
      pageParams: [1, 2]
    });

    applyNcpSessionRealtimeEvent(queryClient, {
      type: 'session.summary.upsert',
      payload: {
        summary: {
          ...current.sessions[1]!,
          updatedAt: '2026-03-29T11:00:00.000Z',
          lastMessageAt: '2026-03-29T11:00:00.000Z',
          messageCount: 3
        }
      }
    });

    const updated = queryClient.getQueryData<InfiniteData<NcpSessionsListView>>(queryKey);
    expect(updated?.pages.map((page) => page.sessions[0]?.sessionId)).toEqual(['session-2', 'session-1']);
    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(false);
  });

  it('invalidates paginated session queries when an upsert changes their membership', () => {
    const queryClient = new QueryClient();
    const queryKey = ['ncp-session-pages', 100, null] as const;
    queryClient.setQueryData<InfiniteData<NcpSessionsListView>>(queryKey, {
      pages: [{ ...createSessionsList(), page: 1, pageSize: 100, hasMore: false }],
      pageParams: [1]
    });

    applyNcpSessionRealtimeEvent(queryClient, {
      type: 'session.summary.upsert',
      payload: {
        summary: {
          sessionId: 'session-3',
          messageCount: 1,
          updatedAt: '2026-03-29T12:00:00.000Z',
          status: 'idle'
        }
      }
    });

    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
  });

  it('patches paginated run status without invalidating the session pages', () => {
    const queryClient = new QueryClient();
    const queryKey = ['ncp-session-pages', 100, null] as const;
    queryClient.setQueryData<InfiniteData<NcpSessionsListView>>(queryKey, {
      pages: [{ ...createSessionsList(), page: 1, pageSize: 100, hasMore: false }],
      pageParams: [1]
    });

    applyNcpSessionRealtimeEvent(queryClient, {
      type: 'session.run-status',
      payload: { sessionKey: 'session-2', status: 'running' }
    });

    const updated = queryClient.getQueryData<InfiniteData<NcpSessionsListView>>(queryKey);
    expect(updated?.pages[0]?.sessions[1]).toMatchObject({
      sessionId: 'session-2',
      messageCount: 2,
      status: 'running'
    });
    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(false);
  });

  it('invalidates filtered paginated queries when an upsert may change search membership', () => {
    const queryClient = new QueryClient();
    const queryKey = ['ncp-session-pages', 100, 'journal'] as const;
    queryClient.setQueryData<InfiniteData<NcpSessionsListView>>(queryKey, {
      pages: [{ ...createSessionsList(), page: 1, pageSize: 100, hasMore: false }],
      pageParams: [1]
    });

    applyNcpSessionRealtimeEvent(queryClient, {
      type: 'session.summary.upsert',
      payload: { summary: { ...createSessionsList().sessions[0]!, metadata: { label: 'Journal' } } }
    });

    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
  });

  it('invalidates paginated queries after deletion changes their membership', () => {
    const queryClient = new QueryClient();
    const queryKey = ['ncp-session-pages', 100, null] as const;
    queryClient.setQueryData<InfiniteData<NcpSessionsListView>>(queryKey, {
      pages: [{ ...createSessionsList(), page: 1, pageSize: 100, hasMore: false }],
      pageParams: [1]
    });

    applyNcpSessionRealtimeEvent(queryClient, {
      type: 'session.summary.delete',
      payload: { sessionKey: 'session-1' }
    });

    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
  });
});
