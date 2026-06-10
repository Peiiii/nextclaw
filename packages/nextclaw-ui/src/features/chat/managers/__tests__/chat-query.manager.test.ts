import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatQueryManager } from '@/features/chat/managers/chat-query.manager';
import { useChatQueryStore } from '@/features/chat/stores/ncp-chat-query.store';
import type { ChatQuerySnapshot } from '@/features/chat/stores/ncp-chat-query.store';

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

describe('ChatQueryManager', () => {
  beforeEach(() => {
    useChatQueryStore.setState({ snapshot: {} });
  });

  it('skips store writes when only query wrapper identity changes', () => {
    const manager = new ChatQueryManager();
    const sessions = { sessions: [] };
    manager.syncSnapshot({
      sessionsQuery: createQuery(sessions) as unknown as ChatQuerySnapshot['sessionsQuery'],
    });
    const setSnapshot = vi.spyOn(useChatQueryStore.getState(), 'setSnapshot');

    manager.syncSnapshot({
      sessionsQuery: createQuery(sessions) as unknown as ChatQuerySnapshot['sessionsQuery'],
    });

    expect(setSnapshot).not.toHaveBeenCalled();
    setSnapshot.mockRestore();
  });
});
