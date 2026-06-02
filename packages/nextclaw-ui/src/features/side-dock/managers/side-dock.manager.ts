import { SIDE_DOCK_BUILT_IN_ITEMS } from '@/features/side-dock/configs/side-dock-built-in-items.config';
import { useSideDockStore } from '@/features/side-dock/stores/side-dock.store';
import type { SideDockItem, SideDockPinnedItem } from '@/features/side-dock/types/side-dock.types';
import {
  createPinnedSideDockItem,
  mergeSideDockItems,
} from '@/features/side-dock/utils/side-dock-item.utils';
import type { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';

export class SideDockManager {
  constructor(private readonly docBrowserManager: DocBrowserManager) {}

  readonly getItems = (): SideDockItem[] => mergeSideDockItems(
    SIDE_DOCK_BUILT_IN_ITEMS,
    useSideDockStore.getState().pinnedItems,
  );

  readonly openItem = (item: Pick<SideDockItem, 'target'>): void => {
    if (item.target.type === 'right-panel-resource') {
      this.docBrowserManager.open(item.target.uri);
    }
  };

  readonly pinItem = (item: SideDockItem, createdAt: string = new Date().toISOString()): void => {
    if (!item.removable) {
      return;
    }
    this.setPinnedItems((items) => {
      if (items.some((pinnedItem) => pinnedItem.id === item.id || pinnedItem.target.uri === item.target.uri)) {
        return items;
      }
      return [...items, createPinnedSideDockItem(item, createdAt)];
    });
  };

  readonly unpinItem = (itemId: string): void => {
    this.setPinnedItems((items) => items.filter((item) => item.id !== itemId));
  };

  readonly reorderPinnedItems = (itemIds: string[]): void => {
    this.setPinnedItems((items) => {
      const itemsById = new Map(items.map((item) => [item.id, item]));
      const orderedItems = itemIds
        .map((id) => itemsById.get(id))
        .filter((item): item is SideDockPinnedItem => item !== undefined);
      const orderedIds = new Set(orderedItems.map((item) => item.id));
      const remainingItems = items.filter((item) => !orderedIds.has(item.id));
      return [...orderedItems, ...remainingItems];
    });
  };

  private readonly setPinnedItems = (
    updater: (items: SideDockPinnedItem[]) => SideDockPinnedItem[],
  ): void => {
    const { pinnedItems, setPinnedItems } = useSideDockStore.getState();
    setPinnedItems(updater(pinnedItems));
  };
}
