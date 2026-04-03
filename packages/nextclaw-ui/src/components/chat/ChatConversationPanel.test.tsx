import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatConversationPanel } from '@/components/chat/ChatConversationPanel';
import { useChatThreadStore } from '@/components/chat/stores/chat-thread.store';

const mocks = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  goToProviders: vi.fn()
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
        childSessionDetailSessionKey: null,
        childSessionDetailParentSessionKey: null,
        childSessionDetailLabel: null,
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
});
