import { useDeferredValue, useMemo } from "react";
import type { SessionEntryView } from "@/shared/lib/api";
import { sessionMatchesQuery } from "@/features/chat/features/session/utils/chat-session-display.utils";
import { adaptNcpSessionSummaries } from "@/features/chat/features/session/utils/ncp-session-adapter.utils";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useInfiniteNcpSessions } from "@/features/chat/features/ncp/hooks/use-ncp-session-queries";
import type { SessionRunStatus } from "@/features/chat/types/session-run-status.types";

export type NcpSessionListItemView = {
  session: SessionEntryView;
  runStatus?: SessionRunStatus;
};

function filterSessionsByQuery(
  sessions: readonly SessionEntryView[],
  query: string,
): SessionEntryView[] {
  return sessions.filter((session) => sessionMatchesQuery(session, query));
}

function shouldShowSessionInSidebar(session: SessionEntryView): boolean {
  if (!session.isChildSession) {
    return true;
  }
  return session.isPromotedChildSession === true;
}

export function useNcpSessionListView(
  params: { limit?: number; query?: string | null } = {},
) {
  const storedQuery = useChatSessionListStore((state) => state.snapshot.query);
  const runningSessionKeys = useChatSessionListStore((state) => state.runningSessionKeys);
  const pinOverrides = useChatSessionListStore((state) => state.optimisticPinnedBySessionKey);
  const query = params.query ?? storedQuery;
  const deferredQuery = useDeferredValue(query);
  const sessionsQuery = useInfiniteNcpSessions({
    pageSize: params.limit ?? 100,
    query: deferredQuery,
  });

  const allItems = useMemo<NcpSessionListItemView[]>(() => {
    const summaries = sessionsQuery.data?.pages.flatMap((page) => page.sessions) ?? [];
    const runningSessionKeySet = new Set(runningSessionKeys);
    return adaptNcpSessionSummaries(summaries).map((session) => ({
      session: {
        ...session,
        metadata: {
          ...session.metadata,
          pinned: pinOverrides[session.key] ?? session.metadata?.pinned === true,
        },
      },
      runStatus: runningSessionKeySet.has(session.key) || session.status === "running"
        ? "running"
        : undefined,
    }));
  }, [pinOverrides, runningSessionKeys, sessionsQuery.data?.pages]);
  const pinnedSessionKeys = useMemo(
    () => allItems.filter(({ session }) => session.metadata?.pinned === true).map(({ session }) => session.key),
    [allItems],
  );
  const items = useMemo<NcpSessionListItemView[]>(() => {
    const visibleItems = allItems.filter(({ session }) =>
      shouldShowSessionInSidebar(session),
    );
    const matchingSessionKeys = new Set(
      filterSessionsByQuery(
        visibleItems.map(({ session }) => session),
        query,
      ).map((session) => session.key),
    );

    return visibleItems.filter(({ session }) =>
      matchingSessionKeys.has(session.key),
    );
  }, [allItems, query]);

  return {
    allItems,
    pinnedSessionKeys,
    isLoading: sessionsQuery.isLoading,
    items,
    hasMore: sessionsQuery.hasNextPage,
    isLoadingMore: sessionsQuery.isFetchingNextPage,
    loadMore: sessionsQuery.fetchNextPage,
  };
}
