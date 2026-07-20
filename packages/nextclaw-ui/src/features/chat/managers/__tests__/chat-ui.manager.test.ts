import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatUiManager } from '@/features/chat/managers/chat-ui.manager';
import type { PanelAppEntryView } from '@/shared/lib/api';
import type * as SharedApi from '@/shared/lib/api';

const { listPanelAppsMock } = vi.hoisted(() => ({
  listPanelAppsMock: vi.fn(),
}));

vi.mock('@/shared/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof SharedApi>();
  return {
    ...actual,
    nextclawClient: {
      panelApps: {
        listPanelApps: listPanelAppsMock,
      },
    },
  };
});

function createDocBrowserManager() {
  return {
    open: vi.fn(),
    openTarget: vi.fn(),
  };
}

function createPanelAppEntry(overrides: Partial<PanelAppEntryView> = {}): PanelAppEntryView {
  return {
    appId: 'reader',
    clientDeclared: false,
    clientGranted: false,
    contentPath: '/api/panel-apps/encoded-reader/content',
    createdAt: '2026-06-09T00:00:00.000Z',
    favorite: false,
    fileName: 'reader.panel',
    id: 'encoded-reader',
    kind: 'folder',
    openCount: 0,
    sizeBytes: 1024,
    title: 'Reader',
    updatedAt: '2026-06-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('ChatUiManager content display', () => {
  beforeEach(() => {
    listPanelAppsMock.mockReset();
    listPanelAppsMock.mockResolvedValue({ entries: [] });
  });

  it('shows URL content through DocBrowser', async () => {
    const docBrowserManager = createDocBrowserManager();
    const manager = new ChatUiManager(
      docBrowserManager as unknown as ConstructorParameters<typeof ChatUiManager>[0],
    );

    await manager.showContent({
      target: {
        type: 'url',
        payload: {
          url: 'https://example.com/read',
        },
      },
      title: 'Example URL',
    });

    expect(docBrowserManager.open).toHaveBeenCalledWith('https://example.com/read', {
      dedupeKey: 'browser:https://example.com/read',
      kind: 'content',
      title: 'Example URL',
    });
  });

  it('opens a listed panel app as a managed DocBrowser target', async () => {
    listPanelAppsMock.mockResolvedValue({
      entries: [createPanelAppEntry()],
    });
    const docBrowserManager = createDocBrowserManager();
    const manager = new ChatUiManager(
      docBrowserManager as unknown as ConstructorParameters<typeof ChatUiManager>[0],
    );

    await manager.showContent({
      target: {
        type: 'panel_app',
        payload: {
          appId: 'reader',
        },
      },
      title: 'Reader',
    });

    expect(docBrowserManager.openTarget).toHaveBeenCalledWith({
      dedupeKey: 'panel-app:encoded-reader',
      historyPolicy: 'managed',
      kind: 'panel-app',
      resourceUri: 'nextclaw://panel-app/encoded-reader',
      title: 'Reader',
      url: '/api/panel-apps/encoded-reader/content',
    }, {
      title: 'Reader',
    });
  });

  it('falls back to the panel app resource URI when no listed entry matches', async () => {
    const docBrowserManager = createDocBrowserManager();
    const manager = new ChatUiManager(
      docBrowserManager as unknown as ConstructorParameters<typeof ChatUiManager>[0],
    );

    await manager.showContent({
      target: {
        type: 'panel_app',
        payload: {
          appId: 'encoded-reader',
        },
      },
      title: 'Reader',
    });

    expect(docBrowserManager.open).toHaveBeenCalledWith('nextclaw://panel-app/encoded-reader', {
      title: 'Reader',
    });
  });

  it('opens an explicit external panel app path without resolving the standard catalog', async () => {
    const docBrowserManager = createDocBrowserManager();
    const manager = new ChatUiManager(
      docBrowserManager as unknown as ConstructorParameters<typeof ChatUiManager>[0],
    );

    await manager.showContent({
      target: {
        type: 'panel_app',
        payload: {
          appId: 'external-reader',
          path: '/tmp/external-reader.panel',
        },
      },
      title: 'External Reader',
    });

    expect(listPanelAppsMock).not.toHaveBeenCalled();
    expect(docBrowserManager.open).toHaveBeenCalledWith(
      'nextclaw://panel-app/external-reader?path=%2Ftmp%2Fexternal-reader.panel',
      { title: 'External Reader' },
    );
  });
});
