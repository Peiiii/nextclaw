import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SideDockManager } from '@/features/side-dock/managers/side-dock.manager';
import { useSideDockStore } from '@/features/side-dock/stores/side-dock.store';
import type { SideDockItem } from '@/features/side-dock/types/side-dock.types';
import type { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';

const customItem: SideDockItem = {
  builtIn: false,
  icon: { type: 'builtin', name: 'docs' },
  id: 'custom-docs',
  labelKey: 'docBrowserHelp',
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

    expect(open).toHaveBeenCalledWith('nextclaw://docs/custom');
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
        labelKey: 'docBrowserHelp',
        target: { type: 'right-panel-resource', uri: 'nextclaw://docs/custom' },
      },
    ]);
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
