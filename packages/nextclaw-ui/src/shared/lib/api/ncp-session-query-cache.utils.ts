import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { NcpSessionSummaryView, NcpSessionsListView, WsEvent } from '@/shared/lib/api';

function readSessionActivityAt(summary: NcpSessionSummaryView): string {
  return summary.lastMessageAt ?? summary.createdAt ?? summary.updatedAt;
}

function isSessionActivityRunning(summary: NcpSessionSummaryView): boolean {
  return (summary.metadata?.last_activity_preview as { state?: unknown } | undefined)?.state === 'running';
}

function sortSessionSummaries(summaries: readonly NcpSessionSummaryView[]): NcpSessionSummaryView[] {
  return [...summaries].sort((left, right) => readSessionActivityAt(right).localeCompare(readSessionActivityAt(left)));
}

function shouldReplaceSessionSummary(current: NcpSessionSummaryView, next: NcpSessionSummaryView): boolean {
  const timeOrder = next.updatedAt.localeCompare(current.updatedAt);
  return timeOrder === 0 ? current.status === next.status || next.status === 'idle' : timeOrder > 0;
}

function queryKeyAcceptsSessionSummary(queryKey: readonly unknown[], summary: NcpSessionSummaryView): boolean {
  if (queryKey[0] !== 'ncp-sessions') {
    return false;
  }
  const peerId = typeof queryKey[2] === 'string' ? queryKey[2].trim() : '';
  return !peerId || summary.peerId === peerId;
}

function updateSessionPages(
  current: InfiniteData<NcpSessionsListView> | undefined,
  update: (sessions: NcpSessionsListView) => NcpSessionsListView | undefined
): InfiniteData<NcpSessionsListView> | undefined {
  if (!current) return current;
  const pageLengths = current.pages.map((page) => page.sessions.length);
  const sessions = current.pages.flatMap((page) => page.sessions);
  const updated = update({
    sessions,
    total: current.pages[0]?.total ?? sessions.length
  });
  if (!updated) return current;
  let offset = 0;
  return {
    ...current,
    pages: current.pages.map((page, index) => {
      const nextOffset = offset + (pageLengths[index] ?? 0);
      const nextPage = {
        ...page,
        sessions: updated.sessions.slice(offset, nextOffset)
      };
      offset = nextOffset;
      return nextPage;
    })
  };
}

function updateExistingNcpSessionSummaryPages(
  queryClient: QueryClient | undefined,
  summary: NcpSessionSummaryView
): void {
  if (!queryClient) return;
  const entries = queryClient.getQueriesData<InfiniteData<NcpSessionsListView>>({
    queryKey: ['ncp-session-pages']
  });
  for (const [queryKey, current] of entries) {
    const query = typeof queryKey[2] === 'string' ? queryKey[2].trim() : '';
    const containsSession = current?.pages.some((page) =>
      page.sessions.some((session) => session.sessionId === summary.sessionId)
    );
    if (query || !containsSession) {
      void queryClient.invalidateQueries({ queryKey, exact: true });
      continue;
    }
    queryClient.setQueryData<InfiniteData<NcpSessionsListView>>(
      queryKey,
      (value) => updateSessionPages(
        value,
        (sessions) => upsertNcpSessionSummaryList(sessions, summary)
      )
    );
  }
}

function updateNcpSessionRunStatusPages(
  queryClient: QueryClient | undefined,
  payload: { sessionKey: string; status: 'running' | 'idle' }
): void {
  queryClient?.setQueriesData<InfiniteData<NcpSessionsListView>>(
    { queryKey: ['ncp-session-pages'] },
    (current) => updateSessionPages(
      current,
      (sessions) => updateNcpSessionRunStatusList(sessions, payload)
    )
  );
}

export function upsertNcpSessionSummaryList(
  current: NcpSessionsListView | undefined,
  summary: NcpSessionSummaryView
): NcpSessionsListView | undefined {
  if (!current) {
    return current;
  }

  const existingIndex = current.sessions.findIndex((session) => session.sessionId === summary.sessionId);
  const nextSessions =
    existingIndex >= 0
      ? current.sessions.map((session, index) =>
          index === existingIndex && shouldReplaceSessionSummary(session, summary)
            ? {
                ...summary,
                status: summary.status === 'idle' && isSessionActivityRunning(summary) ? session.status : summary.status
              }
            : session
        )
      : [...current.sessions, summary];
  const sortedSessions = sortSessionSummaries(nextSessions);

  return {
    ...current,
    sessions: sortedSessions,
    total: sortedSessions.length
  };
}

export function deleteNcpSessionSummaryList(
  current: NcpSessionsListView | undefined,
  sessionKey: string
): NcpSessionsListView | undefined {
  if (!current) {
    return current;
  }

  const normalizedSessionKey = sessionKey.trim();
  if (!normalizedSessionKey) {
    return current;
  }

  const nextSessions = current.sessions.filter((session) => session.sessionId !== normalizedSessionKey);
  if (nextSessions.length === current.sessions.length) {
    return current;
  }

  return {
    ...current,
    sessions: nextSessions,
    total: nextSessions.length
  };
}

export function upsertNcpSessionSummaryInQueryClient(
  queryClient: QueryClient | undefined,
  summary: NcpSessionSummaryView
): void {
  queryClient?.setQueriesData<NcpSessionsListView>(
    { predicate: (query) => queryKeyAcceptsSessionSummary(query.queryKey, summary) },
    (current) => upsertNcpSessionSummaryList(current, summary)
  );
}

export function updateNcpSessionRunStatusList(
  current: NcpSessionsListView | undefined,
  payload: { sessionKey: string; status: 'running' | 'idle' }
): NcpSessionsListView | undefined {
  if (!current) {
    return current;
  }

  const normalizedSessionKey = payload.sessionKey.trim();
  if (!normalizedSessionKey) {
    return current;
  }

  let changed = false;
  const nextSessions = current.sessions.map((session) => {
    if (session.sessionId !== normalizedSessionKey || session.status === payload.status) {
      return session;
    }
    changed = true;
    return {
      ...session,
      status: payload.status
    };
  });

  if (!changed) {
    return current;
  }

  return {
    ...current,
    sessions: nextSessions
  };
}

export function updateNcpSessionRunStatusInQueryClient(
  queryClient: QueryClient | undefined,
  payload: { sessionKey: string; status: 'running' | 'idle' }
): void {
  queryClient?.setQueriesData<NcpSessionsListView>(
    { queryKey: ['ncp-sessions'] },
    (current) => updateNcpSessionRunStatusList(current, payload)
  );
}

export function deleteNcpSessionSummaryInQueryClient(
  queryClient: QueryClient | undefined,
  sessionKey: string
): void {
  queryClient?.setQueriesData<NcpSessionsListView>(
    { queryKey: ['ncp-sessions'] },
    (current) => deleteNcpSessionSummaryList(current, sessionKey)
  );
}

export function applyNcpSessionRealtimeEvent(
  queryClient: QueryClient | undefined,
  event: Extract<WsEvent, { type: 'session.run-status' | 'session.summary.upsert' | 'session.summary.delete' }>
): void {
  if (event.type === 'session.run-status') {
    updateNcpSessionRunStatusInQueryClient(queryClient, event.payload);
    updateNcpSessionRunStatusPages(queryClient, event.payload);
    return;
  }
  if (event.type === 'session.summary.upsert') {
    upsertNcpSessionSummaryInQueryClient(queryClient, event.payload.summary);
    updateExistingNcpSessionSummaryPages(queryClient, event.payload.summary);
    void queryClient?.invalidateQueries({
      queryKey: ['ncp-session-token-usage', event.payload.summary.sessionId],
      exact: true,
    });
    return;
  }

  deleteNcpSessionSummaryInQueryClient(queryClient, event.payload.sessionKey);
  void queryClient?.invalidateQueries({ queryKey: ['ncp-session-pages'] });
}
