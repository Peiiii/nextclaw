import { useMemo } from 'react';
import type { SessionEntryView } from '@/api/types';
import { sessionMatchesQuery } from '@/features/chat/utils/chat-session-display.utils';
import { adaptNcpSessionSummaries } from '@/features/chat/utils/ncp-session-adapter.utils';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { useNcpSessions } from '@/hooks/useConfig';
import type { SessionRunStatus } from '@/lib/session-run-status';

export type NcpSessionListItemView = {
  session: SessionEntryView;
  runStatus?: SessionRunStatus;
};

function filterSessionsByQuery(sessions: readonly SessionEntryView[], query: string): SessionEntryView[] {
  return sessions.filter((session) => sessionMatchesQuery(session, query));
}

function shouldShowSessionInSidebar(session: SessionEntryView): boolean {
  if (!session.isChildSession) {
    return true;
  }
  return session.isPromotedChildSession === true;
}

export function useNcpSessionListView(params: { limit?: number } = {}) {
  const query = useChatSessionListStore((state) => state.snapshot.query);
  const sessionsQuery = useNcpSessions({ limit: params.limit ?? 200 });

  const items = useMemo<NcpSessionListItemView[]>(() => {
    const summaries = sessionsQuery.data?.sessions ?? [];
    const sessions = adaptNcpSessionSummaries(summaries).filter(
      shouldShowSessionInSidebar,
    );
    const filteredSessions = filterSessionsByQuery(sessions, query);
    const summaryBySessionId = new Map(summaries.map((summary) => [summary.sessionId, summary]));

    return filteredSessions.map((session) => ({
      session,
      runStatus: summaryBySessionId.get(session.key)?.status === 'running' ? 'running' : undefined
    }));
  }, [query, sessionsQuery.data?.sessions]);

  return {
    isLoading: sessionsQuery.isLoading,
    items
  };
}
