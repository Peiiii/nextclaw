import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import type { NcpSessionListItemView } from '@/components/chat/ncp/use-ncp-session-list-view';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  setQuery: vi.fn(),
  selectSession: vi.fn(),
  docOpen: vi.fn(),
  updateNcpSession: vi.fn(),
  agents: [] as Array<{ id: string; displayName?: string; avatarUrl?: string | null }>,
  sessionItems: [] as NcpSessionListItemView[],
  isLoading: false
}));

function createSessionItem(session: NcpSessionListItemView['session']): NcpSessionListItemView {
  return { session };
}

vi.mock('@/components/chat/presenter/chat-presenter-context', () => ({
  usePresenter: () => ({
    chatSessionListManager: {
      createSession: mocks.createSession,
      setQuery: mocks.setQuery,
      selectSession: mocks.selectSession
    }
  })
}));

vi.mock('@/components/doc-browser', () => ({
  useDocBrowser: () => ({
    open: mocks.docOpen
  })
}));

vi.mock('@/components/chat/hooks/use-chat-session-label', () => ({
  useChatSessionLabel: () => async (params: {
    sessionKey: string;
    label: string | null;
  }) => {
    mocks.sessionItems = mocks.sessionItems.map((item) =>
      item.session.key === params.sessionKey
        ? {
            ...item,
            session: {
              ...item.session,
              ...(params.label ? { label: params.label } : { label: undefined })
            }
          }
        : item
    );
    return mocks.updateNcpSession(params.sessionKey, { label: params.label });
  }
}));

vi.mock('@/components/chat/ncp/use-ncp-session-list-view', () => ({
  useNcpSessionListView: () => ({
    isLoading: mocks.isLoading,
    items: mocks.sessionItems
  })
}));

vi.mock('@/components/common/BrandHeader', () => ({
  BrandHeader: () => <div data-testid="brand-header" />
}));

vi.mock('@/components/common/StatusBadge', () => ({
  StatusBadge: () => <div data-testid="status-badge" />
}));

vi.mock('@/hooks/agents/useAgents', () => ({
  useAgents: () => ({
    data: {
      agents: mocks.agents
    }
  })
}));

vi.mock('@/components/providers/I18nProvider', () => ({
  useI18n: () => ({
    language: 'en',
    setLanguage: vi.fn()
  })
}));

vi.mock('@/components/providers/ThemeProvider', () => ({
  useTheme: () => ({
    theme: 'warm',
    setTheme: vi.fn()
  })
}));

vi.mock('@/stores/ui.store', () => ({
  useUiStore: (selector: (state: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: 'connected' })
}));

describe('ChatSidebar', () => {
  beforeEach(() => {
    mocks.createSession.mockReset();
    mocks.setQuery.mockReset();
    mocks.selectSession.mockReset();
    mocks.docOpen.mockReset();
    mocks.updateNcpSession.mockReset();
    mocks.updateNcpSession.mockResolvedValue({});
    mocks.agents = [];
    mocks.sessionItems = [];
    mocks.isLoading = false;

    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        defaultSessionType: 'native',
        sessionTypeOptions: [
          { value: 'native', label: 'Native', ready: true },
          { value: 'codex', label: 'Codex', ready: true }
        ]
      }
    });
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        query: ''
      }
    });
  });

  it('closes the create-session menu after choosing a non-default session type', async () => {
    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('Session Type'));
    fireEvent.click(screen.getByText('Codex'));

    expect(mocks.createSession).toHaveBeenCalledWith('codex');
    await waitFor(() => {
      expect(screen.queryByText('Codex')).toBeNull();
    });
  });

  it('shows setup required status for runtime session types that are not ready yet', () => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        sessionTypeOptions: [
          { value: 'native', label: 'Native', ready: true },
          {
            value: 'claude',
            label: 'Claude',
            ready: false,
            reasonMessage: 'Configure a provider API key first.'
          }
        ]
      }
    });

    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('Session Type'));

    expect(screen.getByText('Claude')).not.toBeNull();
    expect(screen.getByText('Setup')).not.toBeNull();
    expect(screen.getByText('Configure a provider API key first.')).not.toBeNull();
  });

  it('shows a session type badge for non-native sessions in the list', () => {
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:codex-1',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T09:05:00.000Z',
        label: 'Codex Task',
        sessionType: 'codex',
        sessionTypeMutable: false,
        messageCount: 2
      })
    ];

    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Codex Task')).not.toBeNull();
    expect(screen.getByText('Codex')).not.toBeNull();
    expect(screen.queryByText('session:codex-1')).toBeNull();
  });

  it('formats non-native session badges generically when the type is no longer in the available options', () => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        sessionTypeOptions: [{ value: 'native', label: 'Native' }]
      }
    });
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:workspace-agent-1',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T09:05:00.000Z',
        label: 'Workspace Task',
        sessionType: 'workspace-agent',
        sessionTypeMutable: false,
        messageCount: 2
      })
    ];

    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Workspace Task')).not.toBeNull();
    expect(screen.getByText('Workspace Agent')).not.toBeNull();
  });

  it('does not show a session type badge for native sessions in the list', () => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        sessionTypeOptions: [{ value: 'native', label: 'Native' }]
      }
    });
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:native-1',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T09:05:00.000Z',
        label: 'Native Task',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 1
      })
    ];

    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Native Task')).not.toBeNull();
    expect(screen.queryByText('Native')).toBeNull();
  });

  it('hides the sidebar agent avatar for the main agent but keeps specialist avatars', () => {
    mocks.agents = [
      { id: 'main', displayName: 'Main' },
      { id: 'engineer', displayName: 'Engineer' }
    ];
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:main-1',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T09:05:00.000Z',
        label: 'Main Task',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 1,
        agentId: 'main'
      }),
      createSessionItem({
        key: 'session:engineer-1',
        createdAt: '2026-03-19T10:00:00.000Z',
        updatedAt: '2026-03-19T10:05:00.000Z',
        label: 'Engineer Task',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 1,
        agentId: 'engineer'
      })
    ];

    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText('Main')).toBeNull();
    expect(screen.getByLabelText('Engineer')).not.toBeNull();
  });

  it('edits the session label inline and saves through the ncp session api by default', async () => {
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:ncp-1',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T09:05:00.000Z',
        label: 'Initial Label',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 1
      })
    ];

    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('Edit'));
    fireEvent.change(screen.getByPlaceholderText('Session label (optional)'), {
      target: { value: 'Renamed Label' }
    });
    fireEvent.click(screen.getByLabelText('Save'));

    await waitFor(() => {
      expect(mocks.updateNcpSession).toHaveBeenCalledWith('session:ncp-1', {
        label: 'Renamed Label'
      });
    });
    expect(screen.getByText('Renamed Label')).not.toBeNull();
  });

  it('cancels inline session label editing without saving', () => {
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:ncp-2',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T09:05:00.000Z',
        label: 'Cancelable Label',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 1
      })
    ];

    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('Edit'));
    fireEvent.change(screen.getByPlaceholderText('Session label (optional)'), {
      target: { value: 'Should Not Persist' }
    });
    fireEvent.click(screen.getByLabelText('Cancel'));

    expect(mocks.updateNcpSession).not.toHaveBeenCalled();
    expect(screen.queryByDisplayValue('Should Not Persist')).toBeNull();
    expect(screen.getByText('Cancelable Label')).not.toBeNull();
  });
});
