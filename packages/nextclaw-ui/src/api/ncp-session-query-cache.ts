import type { QueryClient } from '@tanstack/react-query';
import type { NcpSessionSummaryView, NcpSessionsListView, WsEvent } from '@/api/types';

function sortSessionSummaries(summaries: readonly NcpSessionSummaryView[]): NcpSessionSummaryView[] {
  return [...summaries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function shouldReplaceSessionSummary(
  current: NcpSessionSummaryView,
  next: NcpSessionSummaryView
): boolean {
  const timeOrder = next.updatedAt.localeCompare(current.updatedAt);
  if (timeOrder > 0) {
    return true;
  }
  if (timeOrder < 0) {
    return false;
  }

  if (current.status === next.status) {
    return true;
  }

  return next.status === 'idle';
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
          index === existingIndex && shouldReplaceSessionSummary(session, summary) ? summary : session
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
    { queryKey: ['ncp-sessions'] },
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
    return;
  }
  if (event.type === 'session.summary.upsert') {
    upsertNcpSessionSummaryInQueryClient(queryClient, event.payload.summary);
    return;
  }

  deleteNcpSessionSummaryInQueryClient(queryClient, event.payload.sessionKey);
}
