import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SideDockManager } from '@/features/side-dock/managers/side-dock.manager';
import { useSideDockStore } from '@/features/side-dock/stores/side-dock.store';
import type { SideDockItem } from '@/features/side-dock/types/side-dock.types';
import type { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';

const customItem: SideDockItem = {
  builtIn: false,
  icon: { type: 'builtin', name: 'docs' },
  id: 'custom-docs',
  label: 'Help Docs',
  removable: true,
  target: { type: 'right-panel-resource', uri: 'nextclaw://docs/custom' },
};

describe('SideDockManager', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useSideDockStore.getState().setPinnedItems([]);
  });

  it('opens right panel resource items through DocBrowserManager', () => {
    const open = vi.fn();
    const manager = new SideDockManager({ open } as unknown as DocBrowserManager);

    manager.openItem(customItem);

    expect(open).toHaveBeenCalledWith('nextclaw://docs/custom', {
      dockIcon: { type: 'builtin', name: 'docs' },
      title: 'Help Docs',
    });
  });

  it('pins removable items and keeps built-in items immutable', () => {
    const manager = new SideDockManager({ open: vi.fn() } as unknown as DocBrowserManager);

    manager.pinItem(customItem, '2026-06-02T00:00:00.000Z');
    manager.pinItem({ ...customItem, builtIn: true, id: 'built-in-copy', removable: false });

    expect(useSideDockStore.getState().pinnedItems).toEqual([
      {
        createdAt: '2026-06-02T00:00:00.000Z',
        icon: { type: 'builtin', name: 'docs' },
        id: 'custom-docs',
        label: 'Help Docs',
        target: { type: 'right-panel-resource', uri: 'nextclaw://docs/custom' },
      },
    ]);
  });

  it('pins and unpins the current doc browser tab by resource URI', () => {
    const manager = new SideDockManager({ open: vi.fn() } as unknown as DocBrowserManager);

    manager.pinTab({
      currentUrl: 'https://docs.nextclaw.ai/guide/getting-started',
      history: ['https://docs.nextclaw.ai/guide/getting-started'],
      historyIndex: 0,
      id: 'tab-1',
      kind: 'docs',
      navVersion: 0,
      resourceUri: 'nextclaw://docs/guide/getting-started',
      title: 'Getting Started',
    }, '2026-06-02T00:00:00.000Z');

    expect(useSideDockStore.getState().pinnedItems).toMatchObject([
      {
        createdAt: '2026-06-02T00:00:00.000Z',
        label: 'Getting Started',
        target: { type: 'right-panel-resource', uri: 'nextclaw://docs/guide/getting-started' },
      },
    ]);

    manager.unpinTab({
      currentUrl: 'https://docs.nextclaw.ai/guide/getting-started',
      history: ['https://docs.nextclaw.ai/guide/getting-started'],
      historyIndex: 0,
      id: 'tab-1',
      kind: 'docs',
      navVersion: 0,
      resourceUri: 'nextclaw://docs/guide/getting-started',
      title: 'Getting Started',
    });

    expect(useSideDockStore.getState().pinnedItems).toEqual([]);
  });

  it('pins panel app tabs with their own dock icon metadata', () => {
    const manager = new SideDockManager({ open: vi.fn() } as unknown as DocBrowserManager);

    manager.pinTab({
      currentUrl: '/api/panel-apps/demo/content',
      dockIcon: { type: 'url', url: '/api/panel-apps/demo/assets/icon.png' },
      history: ['/api/panel-apps/demo/content'],
      historyIndex: 0,
      id: 'tab-1',
      kind: 'panel-app',
      navVersion: 0,
      resourceUri: 'nextclaw://panel-app/demo',
      title: 'Demo App',
    }, '2026-06-02T00:00:00.000Z');

    expect(useSideDockStore.getState().pinnedItems).toMatchObject([
      {
        icon: { type: 'url', url: '/api/panel-apps/demo/assets/icon.png' },
        label: 'Demo App',
        target: { type: 'right-panel-resource', uri: 'nextclaw://panel-app/demo' },
      },
    ]);
  });

  it('pins panel app text icons instead of falling back to a generic icon', () => {
    const manager = new SideDockManager({ open: vi.fn() } as unknown as DocBrowserManager);

    manager.pinTab({
      currentUrl: '/api/panel-apps/compass/content',
      dockIcon: { type: 'text', value: 'C' },
      history: ['/api/panel-apps/compass/content'],
      historyIndex: 0,
      id: 'tab-1',
      kind: 'panel-app',
      navVersion: 0,
      resourceUri: 'nextclaw://panel-app/compass',
      title: 'Compass',
    }, '2026-06-02T00:00:00.000Z');

    expect(useSideDockStore.getState().pinnedItems[0]?.icon).toEqual({ type: 'text', value: 'C' });
  });

  it('unpins and reorders pinned items', () => {
    const manager = new SideDockManager({ open: vi.fn() } as unknown as DocBrowserManager);

    manager.pinItem(customItem, '2026-06-02T00:00:00.000Z');
    manager.pinItem({
      ...customItem,
      id: 'custom-apps',
      target: { type: 'right-panel-resource', uri: 'nextclaw://apps/custom' },
    }, '2026-06-02T00:00:01.000Z');
    manager.reorderPinnedItems(['custom-apps', 'custom-docs']);
    manager.unpinItem('custom-docs');

    expect(useSideDockStore.getState().pinnedItems.map((item) => item.id)).toEqual(['custom-apps']);
  });
});
