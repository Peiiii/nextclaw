import { getSideDockBuiltInItems } from '@/features/side-dock/configs/side-dock-built-in-items.config';
import { useSideDockStore } from '@/features/side-dock/stores/side-dock.store';
import type {
  SideDockIconName,
  SideDockItem,
  SideDockPinnedItem,
  SideDockResourceDockState,
} from '@/features/side-dock/types/side-dock.types';
import {
  createPinnedSideDockItem,
  mergeSideDockItems,
} from '@/features/side-dock/utils/side-dock-item.utils';
import { hostCapabilityManager } from '@/shared/lib/host-capabilities';
import type { DocBrowserManager } from '@/shared/components/doc-browser/managers/doc-browser.manager';
import type {
  DocBrowserDockIcon,
  DocBrowserTab,
} from '@/shared/components/doc-browser/types/doc-browser.types';

const SIDE_DOCK_PINNED_ITEM_ID_PREFIX = 'pinned';
const SIDE_DOCK_ICON_NAMES = new Set<SideDockIconName>([
  'apps',
  'docs',
  'github',
  'new-tab',
  'panel-app',
  'service-apps',
]);

function normalizeSideDockResourceUri(uri: string): string {
  return uri.trim();
}

function createPinnedItemId(uri: string): string {
  let hash = 0;
  Array.from(normalizeSideDockResourceUri(uri)).forEach((char) => {
    hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
  });
  const slug = normalizeSideDockResourceUri(uri)
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${SIDE_DOCK_PINNED_ITEM_ID_PREFIX}-${slug || 'resource'}-${hash.toString(36)}`;
}

function resolveSideDockIcon(icon?: DocBrowserDockIcon): SideDockItem['icon'] | null {
  if (icon?.type === 'builtin' && SIDE_DOCK_ICON_NAMES.has(icon.name as SideDockIconName)) {
    return { type: 'builtin', name: icon.name as SideDockIconName };
  }
  if (icon?.type === 'url' && icon.url.trim().length > 0) {
    return { type: 'url', url: icon.url.trim() };
  }
  if (icon?.type === 'text' && icon.value.trim().length > 0) {
    return { type: 'text', value: icon.value.trim() };
  }
  return null;
}

function getFallbackIconNameForTab(tab: DocBrowserTab): SideDockIconName {
  if (tab.kind === 'docs') {
    return 'docs';
  }
  if (tab.kind === 'home') {
    return 'new-tab';
  }
  if (tab.kind === 'apps') {
    return tab.resourceUri?.includes('service-apps') ? 'service-apps' : 'apps';
  }
  if (tab.kind === 'panel-app') {
    return 'panel-app';
  }
  return 'apps';
}

export class SideDockManager {
  constructor(private readonly docBrowserManager: DocBrowserManager) {}

  getItems = (): SideDockItem[] => mergeSideDockItems(
    getSideDockBuiltInItems(),
    useSideDockStore.getState().pinnedItems,
  );

  openItem = async (item: Pick<SideDockItem, 'icon' | 'label' | 'target'>): Promise<void> => {
    if (item.target.type === 'right-panel-resource') {
      this.docBrowserManager.open(item.target.uri, {
        dockIcon: item.icon,
        title: item.label,
      });
      return;
    }
    if (item.target.type === 'external-url') {
      await hostCapabilityManager.openExternalUrl(item.target.url);
    }
  };

  getDockState = (tab?: DocBrowserTab): SideDockResourceDockState => {
    const uri = this.getTabResourceUri(tab);
    if (!uri) {
      return {
        canDock: false,
        isDocked: false,
        removable: false,
      };
    }

    const item = this.findItemByUri(uri);
    return {
      canDock: true,
      isDocked: !!item,
      removable: item?.removable === true,
    };
  };

  pinTab = (tab?: DocBrowserTab, createdAt: string = new Date().toISOString()): void => {
    const uri = this.getTabResourceUri(tab);
    if (!tab || !uri || this.findItemByUri(uri)) {
      return;
    }
    this.pinItem({
      builtIn: false,
      icon: resolveSideDockIcon(tab.dockIcon) ?? { type: 'builtin', name: getFallbackIconNameForTab(tab) },
      id: createPinnedItemId(uri),
      label: tab.title.trim() || uri,
      removable: true,
      target: { type: 'right-panel-resource', uri },
    }, createdAt);
  };

  unpinTab = (tab?: DocBrowserTab): void => {
    const uri = this.getTabResourceUri(tab);
    const item = uri ? this.findItemByUri(uri) : undefined;
    if (!item?.removable) {
      return;
    }
    this.unpinItem(item.id);
  };

  pinItem = (item: SideDockItem, createdAt: string = new Date().toISOString()): void => {
    if (!item.removable || item.target.type !== 'right-panel-resource') {
      return;
    }
    const uri = normalizeSideDockResourceUri(item.target.uri);
    const resourceItem = {
      ...item,
      target: { type: 'right-panel-resource' as const, uri },
    };
    this.setPinnedItems((items) => {
      if (items.some((pinnedItem) => pinnedItem.id === item.id || normalizeSideDockResourceUri(pinnedItem.target.uri) === uri)) {
        return items;
      }
      return [...items, createPinnedSideDockItem(resourceItem, createdAt)];
    });
  };

  unpinItem = (itemId: string): void => {
    this.setPinnedItems((items) => items.filter((item) => item.id !== itemId));
  };

  reorderPinnedItems = (itemIds: string[]): void => {
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

  private setPinnedItems = (
    updater: (items: SideDockPinnedItem[]) => SideDockPinnedItem[],
  ): void => {
    const { pinnedItems, setPinnedItems } = useSideDockStore.getState();
    setPinnedItems(updater(pinnedItems));
  };

  private getTabResourceUri = (tab?: DocBrowserTab): string | null => {
    const uri = tab?.resourceUri ?? tab?.currentUrl;
    const normalized = uri ? normalizeSideDockResourceUri(uri) : '';
    return normalized.length > 0 ? normalized : null;
  };

  private findItemByUri = (uri: string): SideDockItem | undefined => {
    const normalized = normalizeSideDockResourceUri(uri);
    return this.getItems().find((item) => (
      item.target.type === 'right-panel-resource'
      && normalizeSideDockResourceUri(item.target.uri) === normalized
    ));
  };
}
