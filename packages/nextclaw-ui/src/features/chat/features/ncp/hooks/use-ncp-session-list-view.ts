import { useMemo } from 'react';
import type { SessionEntryView } from '@/shared/lib/api';
import { sessionMatchesQuery } from '@/features/chat/features/session/utils/chat-session-display.utils';
import { adaptNcpSessionSummaries } from '@/features/chat/features/session/utils/ncp-session-adapter.utils';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useNcpSessions } from '@/features/chat/features/ncp/hooks/use-ncp-session-queries';
import type { SessionRunStatus } from '@/features/chat/types/session-run-status.types';

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

    return filteredSessions.map((session) => ({
      session,
      runStatus: session.status === 'running' ? 'running' : undefined
    }));
  }, [query, sessionsQuery.data?.sessions]);

  return {
    isLoading: sessionsQuery.isLoading,
    items
  };
}
