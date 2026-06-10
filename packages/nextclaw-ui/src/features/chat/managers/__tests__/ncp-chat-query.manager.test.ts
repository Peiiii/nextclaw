import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NcpChatQueryManager } from '@/features/chat/managers/ncp-chat-query.manager';
import { useNcpChatQueryStore } from '@/features/chat/stores/ncp-chat-query.store';
import type { NcpChatQuerySnapshot } from '@/features/chat/stores/ncp-chat-query.store';

function createQuery<TData>(data: TData) {
  return {
    data,
    error: null,
    fetchStatus: 'idle',
    isFetched: true,
    isFetching: false,
    isLoading: false,
    isSuccess: true,
    status: 'success',
  };
}

describe('NcpChatQueryManager', () => {
  beforeEach(() => {
    useNcpChatQueryStore.setState({ snapshot: {} });
  });

  it('skips store writes when only query wrapper identity changes', () => {
    const manager = new NcpChatQueryManager();
    const sessions = { sessions: [] };
    manager.syncSnapshot({
      sessionsQuery: createQuery(sessions) as unknown as NcpChatQuerySnapshot['sessionsQuery'],
    });
    const setSnapshot = vi.spyOn(useNcpChatQueryStore.getState(), 'setSnapshot');

    manager.syncSnapshot({
      sessionsQuery: createQuery(sessions) as unknown as NcpChatQuerySnapshot['sessionsQuery'],
    });

    expect(setSnapshot).not.toHaveBeenCalled();
    setSnapshot.mockRestore();
  });
});
