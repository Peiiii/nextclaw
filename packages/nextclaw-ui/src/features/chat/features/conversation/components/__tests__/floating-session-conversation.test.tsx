import { AppPresenterProvider } from '@/app/components/app-presenter-provider';
import type { ReactElement } from 'react';

vi.mock('@/features/panel-apps/hooks/use-panel-apps', () => ({
  usePanelApps: () => ({ data: { entries: [] } }),
  useUpdatePanelAppPreferences: () => ({ mutate: vi.fn(), isPending: false }),
}));
function render(ui: ReactElement) {
  return renderUi(<AppPresenterProvider>{ui}</AppPresenterProvider>);
}
import { sessionSurfaceManager } from '@/features/chat/managers/session-surface.manager';
import { act, render as renderUi, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FloatingSessionConversation } from '@/features/chat/features/conversation/components/floating-session-conversation';
import { buildSessionPath } from '@/features/chat/features/session/utils/chat-session-route.utils';

vi.mock('@/features/chat/features/conversation/components/session-conversation-area', () => ({
  SessionConversationArea: ({ sessionKey }: { sessionKey: string }) =>
    <textarea aria-label={sessionKey} />,
}));

function MainConversation() {
  return <><textarea aria-label="main" /><span data-testid="path">{useLocation().pathname}</span></>;
}

describe('Floating conversation shell', () => {
  beforeEach(() => sessionSurfaceManager.close());

  it('preserves the main editor and floating editor identity through minimize and restore', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/chat/current']}>
      <MainConversation /><FloatingSessionConversation />
    </MemoryRouter>);
    const main = screen.getByRole('textbox', { name: 'main' });
    await user.type(main, 'main draft');
    act(() => sessionSurfaceManager.open({ sessionKey: 'other', title: 'Other task' }));
    expect(document.activeElement).toBe(screen.getByTestId('floating-session-conversation'));
    const floating = screen.getByRole('textbox', { name: 'other' });
    await user.type(floating, 'follow-up');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'other' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Expand view' }));
    expect(screen.getByRole('textbox', { name: 'other' })).toBe(floating);
    expect((floating as HTMLTextAreaElement).value).toBe('follow-up');
    expect(screen.getByRole('textbox', { name: 'main' })).toBe(main);
    expect((main as HTMLTextAreaElement).value).toBe('main draft');
    expect(screen.getByTestId('path').textContent).toBe('/chat/current');
    await user.click(screen.getByRole('button', { name: 'Close view' }));
    expect(floating.isConnected).toBe(false);
    expect(main.isConnected).toBe(true);
  });

  it('switches only the floating target and navigates only on explicit main-view action', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/settings']}>
      <MainConversation /><FloatingSessionConversation />
    </MemoryRouter>);
    act(() => sessionSurfaceManager.open({ sessionKey: 'one', title: 'One' }));
    const previous = screen.getByRole('textbox', { name: 'one' });
    act(() => sessionSurfaceManager.open({ sessionKey: 'two', title: 'Two' }));
    expect(previous.isConnected).toBe(false);
    expect(screen.getByRole('textbox', { name: 'two' })).toBeTruthy();
    expect(screen.getByTestId('path').textContent).toBe('/settings');
    await user.click(screen.getByRole('button', { name: 'Open in main area' }));
    expect(screen.getByTestId('path').textContent).toBe(buildSessionPath('two'));
    expect(screen.queryByTestId('floating-session-conversation')).toBeNull();
  });
});
