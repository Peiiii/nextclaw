import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useNcpChatPageData } from '../use-ncp-chat-page-data';

const useNcpSessionSkillsMock = vi.fn();

vi.mock('@/shared/hooks/use-config', () => ({
  useConfig: () => ({
    data: {
      agents: { defaults: {} },
      providers: {}
    },
    isFetched: true,
    isSuccess: true
  }),
  useConfigMeta: () => ({
    data: { providers: [] },
    isFetched: true,
    isSuccess: true
  }),
  useProviders: () => ({
    data: { providers: {} },
    isFetched: true,
    isSuccess: true
  }),
  useProviderTemplates: () => ({
    data: { providerTemplates: [] },
    isFetched: true,
    isSuccess: true
  }),
  useNcpSessions: () => ({
    data: { sessions: [] }
  }),
  useNcpSessionSkills: (params: unknown) => useNcpSessionSkillsMock(params)
}));

vi.mock('../use-ncp-chat-session-types', () => ({
  useNcpChatSessionTypes: () => ({
    data: {
      defaultType: 'native',
      options: [{ value: 'native', label: 'Native' }]
    }
  })
}));

function renderPageData(params: { sessionKey: string | null }) {
  return renderHook(() =>
    useNcpChatPageData({
      sessionKey: params.sessionKey,
      query: '',
      currentSelectedModel: '',
      pendingSessionType: '',
      setPendingSessionType: vi.fn(),
      setSelectedModel: vi.fn(),
      setSelectedThinkingLevel: vi.fn()
    })
  );
}

describe('useNcpChatPageData skills query', () => {
  it('loads draft-session skills before a new chat materializes', () => {
    useNcpSessionSkillsMock.mockReturnValue({ data: { records: [] }, isLoading: false });

    renderPageData({ sessionKey: null });

    expect(useNcpSessionSkillsMock).toHaveBeenCalledWith({
      sessionId: 'draft-session'
    });
  });

  it('loads real session skills after materialization', () => {
    useNcpSessionSkillsMock.mockReturnValue({ data: { records: [] }, isLoading: false });

    renderPageData({ sessionKey: 'session-1' });

    expect(useNcpSessionSkillsMock).toHaveBeenCalledWith({
      sessionId: 'session-1'
    });
  });
});
