import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppPresenterProvider } from '@/app/components/app-presenter-provider';
import { NcpChatPage } from '@/features/chat/pages/ncp-chat-page';
import { buildSessionPath } from '@/features/chat/features/session/utils/chat-session-route.utils';
import { useChatThreadStore } from '@/features/chat/stores/chat-thread.store';

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  consumePending: vi.fn(() => null),
  markConsumed: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
  syncVisibleSessions: vi.fn(),
  useChatSessionSync: vi.fn(),
}));

vi.mock('@/app/presenters/app.presenter', () => ({
  getAppPresenter: () => ({
    docBrowserManager: {},
    chatDraftIntentManager: {
      consumePending: mocks.consumePending,
      markConsumed: mocks.markConsumed,
      subscribe: mocks.subscribe,
    },
    chatCompletionNotificationManager: {
      syncVisibleSessions: mocks.syncVisibleSessions,
    },
  }),
}));

vi.mock('@/shared/hooks/use-confirm-dialog', () => ({
  useConfirmDialog: () => ({
    confirm: mocks.confirm,
    ConfirmDialog: () => <div data-testid="confirm-dialog" />,
  }),
}));

vi.mock('@/features/chat/components/layout/chat-page-shell', () => ({
  ChatPageLayout: () => <div data-testid="chat-page-layout" />,
  useChatSessionSync: (params: {
    routeSessionKey: string | null;
    syncRouteSessionSelection: (routeSessionKey: string | null) => void;
  }) => {
    mocks.useChatSessionSync(params);
    params.syncRouteSessionSelection(params.routeSessionKey);
  },
}));

vi.mock('@/features/chat/features/ncp/hooks/use-ncp-chat-query-store-sync', () => ({
  useChatQueryStoreSync: () => undefined,
}));

vi.mock('@/features/chat/features/ncp/hooks/use-ui-show-content-event', () => ({
  useUiShowContentEvent: () => undefined,
}));

describe('NcpChatPage render boundary', () => {
  beforeEach(() => {
    mocks.syncVisibleSessions.mockReset();
    mocks.useChatSessionSync.mockReset();
    useChatThreadStore.getState().setSnapshot({
      workspacePanelParentKey: null,
      activeWorkspacePanelKind: null,
      activeChildSessionKey: null,
    });
  });

  it('creates its chat presenter from the global app presenter provider', () => {
    render(
      <MemoryRouter initialEntries={['/chat']}>
        <AppPresenterProvider>
          <NcpChatPage view="chat" />
        </AppPresenterProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('chat-page-layout')).toBeTruthy();
    expect(mocks.useChatSessionSync).toHaveBeenCalledOnce();
  });

  it('tracks visible route and workspace sessions, then clears them when chat unmounts', async () => {
    const sessionPath = buildSessionPath('session-background');
    useChatThreadStore.getState().setSnapshot({
      workspacePanelParentKey: 'session-background',
      activeWorkspacePanelKind: 'child-session',
      activeChildSessionKey: 'session-child',
    });
    const view = render(
      <MemoryRouter initialEntries={[sessionPath]}>
        <AppPresenterProvider>
          <Routes>
            <Route path="/chat/:sessionId?" element={<NcpChatPage view="chat" />} />
          </Routes>
        </AppPresenterProvider>
      </MemoryRouter>,
    );

    expect(mocks.syncVisibleSessions).toHaveBeenCalledWith([
      'session-background',
      'session-child',
    ]);

    act(() => {
      useChatThreadStore.getState().setSnapshot({
        activeWorkspacePanelKind: 'file',
      });
    });
    await waitFor(() => {
      expect(mocks.syncVisibleSessions).toHaveBeenLastCalledWith([
        'session-background',
        null,
      ]);
    });

    view.unmount();
    expect(mocks.syncVisibleSessions).toHaveBeenLastCalledWith([]);
  });
});
