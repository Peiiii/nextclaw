import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatChildSessionPanel } from '@/components/chat/chat-child-session-panel';
import { ChatConversationPanel } from '@/components/chat/ChatConversationPanel';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  goToProviders: vi.fn(),
  resolvedChildTabs: [
    {
      sessionKey: 'child-session-1',
      parentSessionKey: 'parent-session-1',
      title: '北京天气',
      agentId: 'weather',
      agentDisplayName: 'Weather',
      agentAvatarUrl: null,
    },
  ],
}));

vi.mock('@nextclaw/agent-chat-ui', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useStickyBottomScroll: () => ({
      onScroll: vi.fn()
    })
  };
});

vi.mock('@/components/chat/nextclaw', () => ({
  ChatInputBarContainer: () => <div data-testid="chat-input-bar" />,
  ChatMessageListContainer: () => <div data-testid="chat-message-list" />
}));

vi.mock('@/components/chat/containers/chat-message-list.container', () => ({
  ChatMessageListContainer: () => <div data-testid="child-chat-message-list" />,
}));

vi.mock('@/components/chat/ChatWelcome', () => ({
  ChatWelcome: () => <div data-testid="chat-welcome" />
}));

vi.mock('@/components/chat/presenter/chat-presenter-context', () => ({
      usePresenter: () => ({
        chatThreadManager: {
          deleteSession: mocks.deleteSession,
          goToProviders: mocks.goToProviders,
          createSession: vi.fn(),
          openSessionFromToolAction: vi.fn(),
          selectChildSessionDetail: vi.fn(),
          closeChildSessionDetail: vi.fn(),
          goToParentSession: vi.fn(),
        },
    chatSessionListManager: {
      selectSession: vi.fn()
    }
  })
}));

vi.mock('@/components/chat/session-header/chat-session-header-actions', () => ({
  ChatSessionHeaderActions: () => <button aria-label="More actions" />
}));

vi.mock('@/components/chat/session-header/chat-session-project-badge', () => ({
  ChatSessionProjectBadge: ({ projectName }: { projectName: string }) => <button>{projectName}</button>
}));

vi.mock('@/components/chat/ncp/session-conversation/use-ncp-child-session-tabs-view', () => ({
  useNcpChildSessionTabsView: () => mocks.resolvedChildTabs,
}));

vi.mock('@/components/chat/ncp/session-conversation/use-ncp-session-conversation', () => ({
  useNcpSessionConversation: () => ({
    visibleMessages: [],
    isHydrating: false,
    hydrateError: null,
    isRunning: false,
  }),
}));

vi.mock('@/components/common/AgentAvatar', () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid="agent-avatar">{agentId}</div>
  ),
}));

vi.mock('@/components/common/agent-identity', () => ({
  AgentIdentityAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid="agent-identity-avatar">{agentId}</div>
  ),
}));

describe('ChatConversationPanel', () => {
  beforeEach(() => {
    mocks.deleteSession.mockReset();
    mocks.goToProviders.mockReset();
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        isProviderStateResolved: true,
        modelOptions: [{ value: 'openai/gpt-5.1', modelLabel: 'gpt-5.1', providerLabel: 'OpenAI' } as never],
        sessionTypeLabel: 'Codex',
        sessionKey: 'draft-session-1',
        sessionDisplayName: undefined,
        agentId: null,
        agentDisplayName: null,
        sessionProjectRoot: null,
        sessionProjectName: null,
        canDeleteSession: false,
        isDeletePending: false,
        isHistoryLoading: false,
        messages: [],
        isSending: false,
        isAwaitingAssistantOutput: false,
        parentSessionKey: null,
        parentSessionLabel: null,
        childSessionTabs: [],
        activeChildSessionKey: null,
      }
    });
  });

  it('shows the draft session type in the conversation header', () => {
    render(<ChatConversationPanel />);

    expect(screen.getByText('New Task')).toBeTruthy();
    expect(screen.getByText('Codex')).toBeTruthy();
    expect(screen.getByLabelText('More actions')).toBeTruthy();
  });

  it('shows the selected session project badge and more actions trigger', () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        sessionKey: 'session-1',
        sessionDisplayName: 'Project Thread',
        sessionProjectRoot: '/Users/demo/workspace/project-alpha',
        sessionProjectName: 'project-alpha',
        canDeleteSession: true,
      }
    });

    render(<ChatConversationPanel />);

    expect(screen.getByText('Project Thread')).toBeTruthy();
    expect(screen.getByText('project-alpha')).toBeTruthy();
    expect(screen.getByLabelText('More actions')).toBeTruthy();
  });

  it('does not show a header agent marker for the main agent', () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        agentId: 'main',
        agentDisplayName: 'Main',
      }
    });

    render(<ChatConversationPanel />);

    expect(screen.queryByTestId('agent-avatar')).toBeNull();
  });

  it('shows only a lightweight avatar marker for a specialist agent', () => {
    useChatThreadStore.setState({
      snapshot: {
        ...useChatThreadStore.getState().snapshot,
        agentId: 'engineer',
        agentDisplayName: 'Engineer',
      }
    });

    render(<ChatConversationPanel />);

    expect(screen.getByTestId('agent-avatar').textContent).toBe('engineer');
    expect(screen.queryByText('Engineer')).toBeNull();
  });
});

describe('ChatChildSessionPanel', () => {
  it('keeps the header compact for a single child session', () => {
    mocks.resolvedChildTabs = [
      {
        sessionKey: 'child-session-1',
        parentSessionKey: 'parent-session-1',
        title: '北京天气',
        agentId: 'weather',
        agentDisplayName: 'Weather',
        agentAvatarUrl: null,
      },
    ];
    render(
      <ChatChildSessionPanel
        tabs={[
          {
            sessionKey: 'child-session-1',
            parentSessionKey: 'parent-session-1',
            label: '北京天气',
            agentId: 'weather',
          },
        ]}
        activeSessionKey="child-session-1"
        onSelectSession={vi.fn()}
        onClose={vi.fn()}
        onBackToParent={vi.fn()}
      />,
    );

    expect(screen.getByText('北京天气')).toBeTruthy();
    expect(screen.queryByText('Child Sessions')).toBeNull();
    expect(screen.queryByText('child-session-1')).toBeNull();
  });

  it('uses tabs as the only title layer when multiple child sessions are open', () => {
    mocks.resolvedChildTabs = [
      {
        sessionKey: 'child-session-1',
        parentSessionKey: 'parent-session-1',
        title: '北京天气',
        agentId: 'weather',
        agentDisplayName: 'Weather',
        agentAvatarUrl: null,
      },
      {
        sessionKey: 'child-session-2',
        parentSessionKey: 'parent-session-1',
        title: '上海天气',
        agentId: 'weather',
        agentDisplayName: 'Weather',
        agentAvatarUrl: null,
      },
    ];

    render(
      <ChatChildSessionPanel
        tabs={[
          {
            sessionKey: 'child-session-1',
            parentSessionKey: 'parent-session-1',
            label: '北京天气',
            agentId: 'weather',
          },
          {
            sessionKey: 'child-session-2',
            parentSessionKey: 'parent-session-1',
            label: '上海天气',
            agentId: 'weather',
          },
        ]}
        activeSessionKey="child-session-1"
        onSelectSession={vi.fn()}
        onClose={vi.fn()}
        onBackToParent={vi.fn()}
      />,
    );

    expect(screen.getAllByText('北京天气')).toHaveLength(1);
    expect(screen.getByText('上海天气')).toBeTruthy();
    const tabButtons = screen.getAllByRole('button').filter((element) =>
      element.getAttribute('aria-pressed') !== null,
    );
    expect(tabButtons).toHaveLength(2);
    expect(tabButtons[0]?.getAttribute('aria-pressed')).toBe('true');
    expect(tabButtons[1]?.getAttribute('aria-pressed')).toBe('false');
  });
});
