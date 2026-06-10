import type { ChatQuerySnapshot } from '@/features/chat/stores/ncp-chat-query.store';
import { useChatQueryStore } from '@/features/chat/stores/ncp-chat-query.store';

function toQuerySnapshotComparable(snapshot: ChatQuerySnapshot) {
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

function hasQuerySnapshotChange(current: ChatQuerySnapshot, patch: Partial<ChatQuerySnapshot>): boolean {
  return JSON.stringify(toQuerySnapshotComparable(current)) !==
    JSON.stringify(toQuerySnapshotComparable({ ...current, ...patch }));
}

export class ChatQueryManager {
  syncSnapshot = (value: Partial<ChatQuerySnapshot>) => {
    const store = useChatQueryStore.getState();
    if (!hasQuerySnapshotChange(store.snapshot, value)) {
      return;
    }
    store.setSnapshot(value);
  };
}
