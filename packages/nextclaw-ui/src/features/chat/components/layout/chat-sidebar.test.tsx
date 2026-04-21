import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSidebar } from '@/features/chat/components/layout/chat-sidebar';
import type { NcpSessionListItemView } from '@/features/chat/hooks/use-ncp-session-list-view';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  setQuery: vi.fn(),
  setListMode: vi.fn(),
  selectSession: vi.fn(),
  openChildSessionPanel: vi.fn(),
  docOpen: vi.fn(),
  updateNcpSession: vi.fn(),
  agents: [] as Array<{ id: string; displayName?: string; avatarUrl?: string | null }>,
  sessionItems: [] as NcpSessionListItemView[],
  isLoading: false
}));

function createSessionItem(
  session: NcpSessionListItemView['session'],
  runStatus?: NcpSessionListItemView['runStatus'],
): NcpSessionListItemView {
  return { session, runStatus };
}

vi.mock('@/features/chat/components/providers/chat-presenter.provider', () => ({
  usePresenter: () => ({
    chatSessionListManager: {
      createSession: mocks.createSession,
      setQuery: mocks.setQuery,
      setListMode: mocks.setListMode,
      selectSession: mocks.selectSession,
      markSessionRead: (
        sessionKey: string | null | undefined,
        readAt: string | null | undefined,
      ) => (sessionKey ? useChatSessionListStore.getState().markSessionRead(sessionKey, readAt) : undefined),
    },
    chatThreadManager: {
      openChildSessionPanel: mocks.openChildSessionPanel,
    },
  })
}));

vi.mock('@/components/doc-browser', () => ({
  useDocBrowser: () => ({
    open: mocks.docOpen
  })
}));

vi.mock('@/features/chat/hooks/use-chat-session-label', () => ({
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

vi.mock('@/features/chat/hooks/use-ncp-session-list-view', () => ({
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

vi.mock('@/features/system-status', () => ({
  useSystemStatus: () => ({
    connectionStatus: 'connected'
  })
}));

function resetSidebarTestState() {
  mocks.createSession.mockReset();
  mocks.setQuery.mockReset();
  mocks.setListMode.mockReset();
  mocks.selectSession.mockReset();
  mocks.openChildSessionPanel.mockReset();
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
    optimisticReadAtBySessionKey: {},
    snapshot: {
      ...useChatSessionListStore.getState().snapshot,
      query: '',
      listMode: 'time-first',
      selectedSessionKey: null
    }
  });
}

describe('ChatSidebar create and list basics', () => {
  beforeEach(resetSidebarTestState);

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

  it('renders the lightweight list mode switch in the session header row and toggles to project view', () => {
    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Sessions')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Project' }));

    expect(mocks.setListMode).toHaveBeenCalledWith('project-first');
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
});

describe('ChatSidebar project-first mode', () => {
  beforeEach(resetSidebarTestState);

  it('shows project groups only in project-first mode and hides sessions without a project', () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        listMode: 'project-first'
      }
    });
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:project-1',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T11:05:00.000Z',
        label: 'Project Alpha Task',
        projectRoot: '/tmp/project-alpha',
        projectName: 'project-alpha',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 2
      }),
      createSessionItem({
        key: 'session:plain-1',
        createdAt: '2026-03-19T08:00:00.000Z',
        updatedAt: '2026-03-19T08:05:00.000Z',
        label: 'Loose Task',
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

    expect(screen.getByText('project-alpha')).not.toBeNull();
    expect(screen.getByText('Project Alpha Task')).not.toBeNull();
    expect(screen.queryByText('Loose Task')).toBeNull();
  });

  it('lets the user choose a runtime type when creating a project-bound draft', () => {
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        listMode: 'project-first'
      }
    });
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:project-2',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T11:05:00.000Z',
        label: 'Grouped Task',
        projectRoot: '/tmp/project-beta',
        projectName: 'project-beta',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 2
      })
    ];

    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'New Task · project-beta' }));
    fireEvent.click(screen.getByText('Codex'));

    expect(mocks.createSession).toHaveBeenCalledWith('codex', '/tmp/project-beta');
  });

  it('creates immediately when there is only one available runtime type', () => {
    useChatInputStore.setState({
      snapshot: {
        ...useChatInputStore.getState().snapshot,
        defaultSessionType: 'native',
        sessionTypeOptions: [{ value: 'native', label: 'Native', ready: true }]
      }
    });
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        listMode: 'project-first'
      }
    });
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:project-3',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T11:05:00.000Z',
        label: 'Single Runtime Task',
        projectRoot: '/tmp/project-gamma',
        projectName: 'project-gamma',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 2
      })
    ];

    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'New Task · project-gamma' }));

    expect(mocks.createSession).toHaveBeenCalledWith('native', '/tmp/project-gamma');
  });
});

describe('ChatSidebar session item interactions', () => {
  beforeEach(resetSidebarTestState);

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

  it('shows an unread dot only after a non-active session finishes its newer update', () => {
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:ncp-1',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T09:05:00.000Z',
        lastMessageAt: '2026-03-19T09:05:00.000Z',
        readAt: '2026-03-19T09:05:00.000Z',
        label: 'Current Task',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 1
      }),
      createSessionItem({
        key: 'session:ncp-2',
        createdAt: '2026-03-19T10:00:00.000Z',
        updatedAt: '2026-03-19T10:05:00.000Z',
        lastMessageAt: '2026-03-19T10:05:00.000Z',
        readAt: '2026-03-19T10:05:00.000Z',
        label: 'Background Task',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 1
      }, 'running')
    ];
    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: 'session:ncp-1'
      }
    });

    const { rerender } = render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText('Session has unread updates')).toBeNull();

    mocks.sessionItems = [
      mocks.sessionItems[0]!,
      createSessionItem({
        key: 'session:ncp-2',
        createdAt: '2026-03-19T10:00:00.000Z',
        updatedAt: '2026-03-19T10:06:00.000Z',
        lastMessageAt: '2026-03-19T10:06:00.000Z',
        readAt: '2026-03-19T10:05:00.000Z',
        label: 'Background Task',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 2
      }, 'running')
    ];

    rerender(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText('Session has unread updates')).toBeNull();

    mocks.sessionItems = [
      mocks.sessionItems[0]!,
      createSessionItem({
        key: 'session:ncp-2',
        createdAt: '2026-03-19T10:00:00.000Z',
        updatedAt: '2026-03-19T10:06:00.000Z',
        lastMessageAt: '2026-03-19T10:06:00.000Z',
        readAt: '2026-03-19T10:05:00.000Z',
        label: 'Background Task',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 2
      })
    ];

    rerender(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('Session has unread updates')).toBeTruthy();

    useChatSessionListStore.setState({
      snapshot: {
        ...useChatSessionListStore.getState().snapshot,
        selectedSessionKey: 'session:ncp-2'
      }
    });

    rerender(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    expect(screen.queryByLabelText('Session has unread updates')).toBeNull();
  });

  it('does not show an unread dot for sessions without a persisted ui read baseline', () => {
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:ncp-legacy',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T09:05:00.000Z',
        lastMessageAt: '2026-03-19T09:05:00.000Z',
        label: 'Legacy Session',
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

    expect(screen.queryByLabelText('Session has unread updates')).toBeNull();
  });

  it('opens the child-session browser from a parent session row', () => {
    mocks.sessionItems = [
      createSessionItem({
        key: 'session:parent-1',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T09:05:00.000Z',
        label: 'Parent Task',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 1
      }),
      createSessionItem({
        key: 'session:child-1',
        createdAt: '2026-03-19T09:06:00.000Z',
        updatedAt: '2026-03-19T09:07:00.000Z',
        label: 'Child Task',
        sessionType: 'native',
        sessionTypeMutable: false,
        messageCount: 1,
        parentSessionId: 'session:parent-1'
      })
    ];

    render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('View child sessions'));

    expect(mocks.openChildSessionPanel).toHaveBeenCalledWith({
      parentSessionKey: 'session:parent-1',
      activeChildSessionKey: 'session:child-1',
    });
  });
});
