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
  findPanelAppEntryByDisplayId: (entries: Array<{ appId: string; id: string; title: string }>, value: string) =>
    entries.find((entry) => [entry.appId, entry.id, entry.title].includes(value)) ?? null,
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
});

it('renders inline panel apps as bounded card-mode iframes with an expand action', () => {
  render(<ChatInlinePanelAppCard panelApp={{
    action: {
      kind: 'show-content',
      label: 'Show content',
      request: {
        placement: 'side_panel',
        target: {
          payload: { appId: 'weather-card' },
          type: 'panel_app',
        },
        title: 'Weather',
      },
    },
    appId: 'weather-card',
    title: 'Weather',
  }} />);

  const iframe = screen.getByTitle('Weather');
  expect(iframe.getAttribute('src')).toBe(
    '/api/panel-apps/weather-card/content?nextclawDisplayMode=card&nextclawPlacement=inline',
  );
  expect(iframe.getAttribute('scrolling')).toBe('auto');

  fireEvent.click(screen.getByLabelText('chatPanelCardExpand'));

  expect(mocks.openTarget).toHaveBeenCalledWith(expect.objectContaining({
    dedupeKey: 'panel-app:weather-card',
    kind: 'panel-app',
    title: 'Weather',
    url: '/api/panel-apps/weather-card/content',
  }));
});
