import type { NcpChatQuerySnapshot } from '@/features/chat/stores/ncp-chat-query.store';
import { useNcpChatQueryStore } from '@/features/chat/stores/ncp-chat-query.store';

function toQuerySnapshotComparable(snapshot: NcpChatQuerySnapshot) {
  const toQueryComparable = (query: unknown) => {
    if (!query || typeof query !== 'object') {
      return query;
    }
    const record = query as Record<string, unknown>;
    const error = record.error instanceof Error
      ? { name: record.error.name, message: record.error.message }
      : record.error;
    return {
      data: record.data,
      error,
      status: record.status,
      fetchStatus: record.fetchStatus,
      isLoading: record.isLoading,
      isFetching: record.isFetching,
      isFetched: record.isFetched,
      isSuccess: record.isSuccess,
    };
  };
  return {
    configQuery: toQueryComparable(snapshot.configQuery),
    providersQuery: toQueryComparable(snapshot.providersQuery),
    providerTemplatesQuery: toQueryComparable(snapshot.providerTemplatesQuery),
    sessionsQuery: toQueryComparable(snapshot.sessionsQuery),
    sessionTypesQuery: toQueryComparable(snapshot.sessionTypesQuery),
    sessionSkillsSessionId: snapshot.sessionSkillsSessionId,
    sessionSkillsQuery: toQueryComparable(snapshot.sessionSkillsQuery),
  };
}

function hasQuerySnapshotChange(current: NcpChatQuerySnapshot, patch: Partial<NcpChatQuerySnapshot>): boolean {
  return JSON.stringify(toQuerySnapshotComparable(current)) !==
    JSON.stringify(toQuerySnapshotComparable({ ...current, ...patch }));
}

export class NcpChatQueryManager {
  syncSnapshot = (value: Partial<NcpChatQuerySnapshot>) => {
    const store = useNcpChatQueryStore.getState();
    if (!hasQuerySnapshotChange(store.snapshot, value)) {
      return;
    }
    store.setSnapshot(value);
  };
}
