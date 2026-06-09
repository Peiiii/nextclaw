import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatSidebar } from '@/features/chat/components/layout/chat-sidebar';
import type { NcpSessionListItemView } from '@/features/chat/features/ncp/hooks/use-ncp-session-list-view';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';

const mocks = vi.hoisted(() => ({
  sessionItems: [] as NcpSessionListItemView[],
}));

vi.mock('@/features/chat/components/providers/chat-presenter.provider', () => ({
  usePresenter: () => ({
    chatUiManager: {
      goToSession: vi.fn(),
      goToChatRoot: vi.fn(),
    },
    chatSessionListManager: {
      createSession: vi.fn(),
      setQuery: vi.fn(),
      setListMode: vi.fn(),
      selectSession: vi.fn(),
      markSessionRead: (
        sessionKey: string | null | undefined,
        readAt: string | null | undefined,
      ) => (sessionKey ? useChatSessionListStore.getState().markSessionRead(sessionKey, readAt) : undefined),
    },
    chatThreadManager: {
      openChildSessionPanel: vi.fn(),
    },
  }),
}));

vi.mock('@/features/chat/features/ncp/hooks/use-ncp-session-list-view', () => ({
  useNcpSessionListView: () => ({
    isLoading: false,
    items: mocks.sessionItems,
  }),
}));

vi.mock('@/features/chat/features/session/hooks/use-chat-sidebar-session-label-editor', () => ({
  useChatSidebarSessionLabelEditor: () => ({
    editingSessionKey: null,
    draftLabel: '',
    savingSessionKey: null,
    setDraftLabel: vi.fn(),
    startEditingSessionLabel: vi.fn(),
    cancelEditingSessionLabel: vi.fn(),
    saveSessionLabel: vi.fn(),
  }),
}));

vi.mock('@/shared/hooks/use-agents', () => ({
  useAgents: () => ({ data: { agents: [] } }),
}));

vi.mock('@/features/system-status', () => ({
  useSystemStatus: () => ({ connectionStatus: 'connected' }),
}));

vi.mock('@/shared/components/doc-browser', () => ({
  useDocBrowser: () => ({ open: vi.fn() }),
}));

vi.mock('@/shared/components/common/brand-header', () => ({
  BrandHeader: () => <div data-testid="brand-header" />,
}));

vi.mock('@/shared/components/common/status-badge', () => ({
  StatusBadge: () => <div data-testid="status-badge" />,
}));

vi.mock('@/app/components/i18n-provider', () => ({
  useI18n: () => ({ language: 'en', setLanguage: vi.fn() }),
}));

vi.mock('@/app/components/theme-provider', () => ({
  useTheme: () => ({ theme: 'warm', setTheme: vi.fn() }),
}));

function createRunningSessionItem(runStatus?: NcpSessionListItemView['runStatus']): NcpSessionListItemView {
  return {
    runStatus,
    session: {
      key: 'session:ncp-running',
      createdAt: '2026-03-19T09:00:00.000Z',
      updatedAt: '2026-03-19T09:05:00.000Z',
      lastMessageAt: '2026-03-19T09:05:00.000Z',
      readAt: '2026-03-19T09:04:00.000Z',
      label: 'Running Task',
      sessionType: 'native',
      sessionTypeMutable: false,
      messageCount: 2,
    },
  };
}

function resetReadStateTestState() {
  mocks.sessionItems = [];
  useChatInputStore.setState({
    snapshot: {
      ...useChatInputStore.getState().snapshot,
      defaultSessionType: 'native',
      sessionTypeOptions: [{ value: 'native', label: 'Native', ready: true }],
    },
  });
  useChatSessionListStore.setState({
    optimisticReadAtBySessionKey: {},
    snapshot: {
      ...useChatSessionListStore.getState().snapshot,
      query: '',
      listMode: 'time-first',
      selectedSessionKey: 'session:ncp-running',
    },
  });
}

describe('ChatSidebar read state sync', () => {
  beforeEach(resetReadStateTestState);

  it('waits until the active running session is idle before persisting the read watermark', async () => {
    mocks.sessionItems = [createRunningSessionItem('running')];
    const { rerender } = render(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(useChatSessionListStore.getState().optimisticReadAtBySessionKey['session:ncp-running']).toBeUndefined();
    });

    mocks.sessionItems = [createRunningSessionItem()];
    rerender(
      <MemoryRouter>
        <ChatSidebar />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(useChatSessionListStore.getState().optimisticReadAtBySessionKey['session:ncp-running']).toBe('2026-03-19T09:05:00.000Z');
    });
  });
});
