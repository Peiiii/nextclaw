import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppPresenterProvider } from '@/app/components/app-presenter-provider';
import { NcpChatPage } from '@/features/chat/pages/ncp-chat-page';
import { buildSessionPath } from '@/features/chat/features/session/utils/chat-session-route.utils';

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  consumePending: vi.fn(() => null),
  markConsumed: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
  syncActiveSession: vi.fn(),
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
      syncActiveSession: mocks.syncActiveSession,
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
    mocks.syncActiveSession.mockReset();
    mocks.useChatSessionSync.mockReset();
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

  it('syncs the active route session and clears it when chat unmounts', () => {
    const sessionPath = buildSessionPath('session-background');
    const view = render(
      <MemoryRouter initialEntries={[sessionPath]}>
        <AppPresenterProvider>
          <Routes>
            <Route path="/chat/:sessionId?" element={<NcpChatPage view="chat" />} />
          </Routes>
        </AppPresenterProvider>
      </MemoryRouter>,
    );

    expect(mocks.syncActiveSession).toHaveBeenCalledWith('session-background');
    view.unmount();
    expect(mocks.syncActiveSession).toHaveBeenLastCalledWith(null);
  });
});
