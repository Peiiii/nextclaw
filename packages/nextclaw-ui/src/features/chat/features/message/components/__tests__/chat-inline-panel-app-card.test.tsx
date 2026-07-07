import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ChatInlinePanelAppCard } from '@/features/chat/features/message/components/chat-inline-panel-app-card';

const mocks = vi.hoisted(() => ({
  handleIframeMessage: vi.fn(),
  open: vi.fn(),
  openTarget: vi.fn(),
  panelApps: {
    data: {
      entries: [
        {
          appId: 'weather-card',
          contentPath: '/api/panel-apps/weather-card/content',
          fileName: 'weather-card.panel.html',
          icon: '*',
          id: 'weather-card',
          title: 'Weather',
        },
      ],
    },
    isLoading: false,
  },
}));

vi.mock('@/app/presenters/app.presenter', () => ({
  getPresenter: () => ({
    panelAppBridgeManager: {
      handleIframeMessage: mocks.handleIframeMessage,
    },
  }),
}));

vi.mock('@/features/panel-apps', () => ({
  PANEL_APP_IFRAME_SANDBOX: 'allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-pointer-lock allow-presentation',
  findPanelAppEntryByDisplayId: (entries: Array<{ appId: string; id: string; title: string }>, value: string) =>
    entries.find((entry) => [entry.appId, entry.id, entry.title].includes(value)) ?? null,
  focusPanelAppIframe: (iframe: HTMLIFrameElement | null) => {
    iframe?.focus({ preventScroll: true });
    iframe?.contentWindow?.focus();
  },
  usePanelApps: () => mocks.panelApps,
}));

vi.mock('@/shared/components/doc-browser', () => ({
  useDocBrowser: () => ({
    open: mocks.open,
    openTarget: mocks.openTarget,
  }),
}));

vi.mock('@/shared/lib/i18n', () => ({
  t: (key: string) => key,
}));

beforeEach(() => {
  mocks.handleIframeMessage.mockReset();
  mocks.open.mockReset();
  mocks.openTarget.mockReset();
  mocks.panelApps.isLoading = false;
});

it('renders inline panel apps as bounded card-mode iframes with an expand action', () => {
  render(<ChatInlinePanelAppCard panelApp={{
    appId: 'weather-card',
    title: 'Weather',
  }} />);

  const iframe = screen.getByTitle('Weather');
  const card = iframe.closest('[data-chat-message-wide-content="true"]');
  expect(card?.className).toContain('w-full');
  expect(card?.className).toContain('max-w-[48rem]');
  expect(iframe.getAttribute('src')).toBe(
    '/api/panel-apps/weather-card/content?nextclawDisplayMode=card&nextclawPlacement=inline',
  );

  fireEvent.click(screen.getByLabelText('chatPanelCardExpand'));

  expect(mocks.openTarget).toHaveBeenCalledWith(expect.objectContaining({
    dedupeKey: 'panel-app:weather-card',
    kind: 'panel-app',
    title: 'Weather',
    url: '/api/panel-apps/weather-card/content',
  }));
});

it('focuses the inline panel app iframe when the pointer enters it', () => {
  render(<ChatInlinePanelAppCard panelApp={{
    appId: 'weather-card',
    title: 'Weather',
  }} />);

  const iframe = screen.getByTitle('Weather') as HTMLIFrameElement;
  const iframeFocus = vi.spyOn(iframe, 'focus');
  const contentWindowFocus = vi.spyOn(iframe.contentWindow!, 'focus').mockImplementation(() => undefined);

  fireEvent.pointerOver(iframe);

  expect(iframe.getAttribute('tabindex')).toBe('0');
  expect(iframeFocus).toHaveBeenCalledWith({ preventScroll: true });
  expect(contentWindowFocus).toHaveBeenCalled();
});

it('can render inline panel apps without a side-panel expand action', () => {
  render(
    <ChatInlinePanelAppCard
      panelApp={{
        appId: 'weather-card',
        title: 'Weather',
      }}
      showExpandAction={false}
    />,
  );

  expect(screen.getByTitle('Weather')).toBeTruthy();
  expect(screen.queryByLabelText('chatPanelCardExpand')).toBeNull();
  expect(mocks.open).not.toHaveBeenCalled();
  expect(mocks.openTarget).not.toHaveBeenCalled();
});
