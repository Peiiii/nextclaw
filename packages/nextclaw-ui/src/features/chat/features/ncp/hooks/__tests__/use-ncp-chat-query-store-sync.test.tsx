import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatQueryStoreSync } from '@/features/chat/features/ncp/hooks/use-ncp-chat-query-store-sync';

const useNcpSessionSkillsMock = vi.fn();
const syncSnapshotMock = vi.fn();
const chatQueryManagerMock = {
  syncSnapshot: syncSnapshotMock
};
const configData = { agents: { defaults: {} }, providers: {} };
const providersData = { providers: {} };
const templatesData = { providerTemplates: [] };
const sessionsData = { sessions: [] };
const sessionSkillsData = { records: [] };
const sessionTypesData = {
  defaultType: 'native',
  options: [{ value: 'native', label: 'Native' }]
};

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

vi.mock('@/shared/hooks/use-config', () => ({
  useConfig: () => createQuery(configData),
  useConfigMeta: () => ({
    data: { providers: [] },
    isFetched: true,
    isSuccess: true
  }),
  useProviders: () => createQuery(providersData),
  useProviderTemplates: () => createQuery(templatesData)
}));

vi.mock('@/features/chat/features/ncp/hooks/use-ncp-session-queries', () => ({
  useNcpSessions: () => createQuery(sessionsData),
  useNcpSessionSkills: (params: unknown) => useNcpSessionSkillsMock(params)
}));

vi.mock('@/features/chat/features/session-type/hooks/use-ncp-chat-session-types', () => ({
  useNcpChatSessionTypes: () => createQuery(sessionTypesData)
}));

vi.mock('@/features/chat/components/providers/chat-presenter.provider', () => ({
  usePresenter: () => ({
    chatQueryManager: chatQueryManagerMock
  })
}));

beforeEach(() => {
  syncSnapshotMock.mockClear();
  useNcpSessionSkillsMock.mockReset();
});

function renderQuerySync(params: { sessionKey: string | null }) {
  return renderHook(() =>
    useChatQueryStoreSync({
      sessionKey: params.sessionKey,
    })
  );
}

describe('useChatQueryStoreSync skills query', () => {
  it('loads draft-session skills before a new chat materializes', async () => {
    const sessionSkillsQuery = createQuery(sessionSkillsData);
    useNcpSessionSkillsMock.mockReturnValue(sessionSkillsQuery);

    renderQuerySync({ sessionKey: null });

    expect(useNcpSessionSkillsMock).toHaveBeenCalledWith({
      sessionId: 'draft-session'
    });
    await waitFor(() =>
      expect(syncSnapshotMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionSkillsSessionId: 'draft-session',
          sessionSkillsQuery
        })
      )
    );
  });

  it('loads real session skills after materialization', () => {
    useNcpSessionSkillsMock.mockReturnValue(createQuery(sessionSkillsData));

    renderQuerySync({ sessionKey: 'session-1' });

    expect(useNcpSessionSkillsMock).toHaveBeenCalledWith({
      sessionId: 'session-1'
    });
  });
});
