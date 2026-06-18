import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AppPresenterProvider } from '@/app/components/app-presenter-provider';
import { NcpChatPage } from '@/features/chat/pages/ncp-chat-page';

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  consumePending: vi.fn(() => null),
  markConsumed: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
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
    syncRouteSessionSelection: (value: {
      isChatView: boolean;
      routeSessionKey: string | null;
    }) => void;
  }) => {
    mocks.useChatSessionSync(params);
    const { syncRouteSessionSelection } = params;
    syncRouteSessionSelection({
      isChatView: true,
      routeSessionKey: null,
    });
  },
}));

vi.mock('@/features/chat/features/ncp/hooks/use-ncp-chat-query-store-sync', () => ({
  useChatQueryStoreSync: () => undefined,
}));

vi.mock('@/features/chat/features/ncp/hooks/use-ui-show-content-event', () => ({
  useUiShowContentEvent: () => undefined,
}));

describe('NcpChatPage render boundary', () => {
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
});
