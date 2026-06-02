import type {
  SideDockIconName,
  SideDockItem,
  SideDockItemIcon,
  SideDockPinnedItem,
} from '@/features/side-dock/types/side-dock.types';

const SIDE_DOCK_BUILTIN_ICON_NAMES: SideDockIconName[] = [
  'apps',
  'docs',
  'new-tab',
  'service-apps',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isSideDockIconName(value: unknown): value is SideDockIconName {
  return SIDE_DOCK_BUILTIN_ICON_NAMES.includes(value as SideDockIconName);
}

function normalizeSideDockIcon(value: unknown): SideDockItemIcon | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }

  if (value.type === 'builtin' && isSideDockIconName(value.name)) {
    return {
      type: 'builtin',
      name: value.name,
    };
  }

  if (value.type === 'url' && typeof value.url === 'string' && value.url.trim().length > 0) {
    return {
      type: 'url',
      url: value.url.trim(),
    };
  }

  return null;
}

export function normalizeSideDockPinnedItem(value: unknown): SideDockPinnedItem | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || value.id.trim().length === 0
    || typeof value.labelKey !== 'string'
    || value.labelKey.trim().length === 0
    || typeof value.createdAt !== 'string'
    || value.createdAt.trim().length === 0
    || !isRecord(value.target)
    || value.target.type !== 'right-panel-resource'
    || typeof value.target.uri !== 'string'
    || value.target.uri.trim().length === 0
  ) {
    return null;
  }

  const icon = normalizeSideDockIcon(value.icon);
  if (!icon) {
    return null;
  }

  return {
    createdAt: value.createdAt,
    icon,
    id: value.id.trim(),
    labelKey: value.labelKey.trim(),
    target: {
      type: 'right-panel-resource',
      uri: value.target.uri.trim(),
    },
  };
}

export function normalizeSideDockPinnedItems(value: unknown): SideDockPinnedItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const itemsById = new Map<string, SideDockPinnedItem>();
  value.forEach((item) => {
    const normalized = normalizeSideDockPinnedItem(item);
    if (normalized) {
      itemsById.set(normalized.id, normalized);
    }
  });
  return Array.from(itemsById.values());
}

export function createPinnedSideDockItem(item: SideDockItem, createdAt: string): SideDockPinnedItem {
  return {
    createdAt,
    icon: item.icon,
    id: item.id,
    labelKey: item.labelKey,
    target: item.target,
  };
}

export function createSideDockItemFromPinnedItem(item: SideDockPinnedItem): SideDockItem {
  return {
    builtIn: false,
    icon: item.icon,
    id: item.id,
    labelKey: item.labelKey,
    removable: true,
    target: item.target,
  };
}

export function mergeSideDockItems(
  builtInItems: SideDockItem[],
  pinnedItems: SideDockPinnedItem[],
): SideDockItem[] {
  const seenIds = new Set(builtInItems.map((item) => item.id));
  const seenUris = new Set(builtInItems.map((item) => item.target.uri));
  const customItems = pinnedItems
    .filter((item) => !seenIds.has(item.id) && !seenUris.has(item.target.uri))
    .map(createSideDockItemFromPinnedItem);

  return [...builtInItems, ...customItems];
}
