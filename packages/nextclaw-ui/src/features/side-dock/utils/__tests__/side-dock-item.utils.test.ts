import { describe, expect, it } from 'vitest';
import type { SideDockItem } from '@/features/side-dock/types/side-dock.types';
import {
  mergeSideDockItems,
  normalizeSideDockPinnedItem,
  normalizeSideDockPinnedItems,
} from '@/features/side-dock/utils/side-dock-item.utils';

const builtInItem: SideDockItem = {
  builtIn: true,
  icon: { type: 'builtin', name: 'apps' },
  id: 'apps',
  label: 'Apps',
  removable: false,
  target: { type: 'right-panel-resource', uri: 'nextclaw://apps' },
};

describe('side-dock-item utils', () => {
  it('normalizes persisted pinned items and drops malformed entries', () => {
    const items = normalizeSideDockPinnedItems([
      {
        createdAt: '2026-06-02T00:00:00.000Z',
        icon: { type: 'text', value: 'D' },
        id: 'docs-custom',
        label: 'Help Docs',
        target: { type: 'right-panel-resource', uri: 'nextclaw://docs' },
      },
      {
        createdAt: '2026-06-02T00:00:00.000Z',
        icon: { type: 'builtin', name: 'unknown' },
        id: 'bad-icon',
        label: 'Bad',
        target: { type: 'right-panel-resource', uri: 'nextclaw://bad' },
      },
    ]);

    expect(items).toEqual([
      {
        createdAt: '2026-06-02T00:00:00.000Z',
        icon: { type: 'text', value: 'D' },
        id: 'docs-custom',
        label: 'Help Docs',
        target: { type: 'right-panel-resource', uri: 'nextclaw://docs' },
      },
    ]);
  });

  it('rejects invalid single pinned item payloads', () => {
    expect(normalizeSideDockPinnedItem({ id: 'missing-fields' })).toBeNull();
    expect(normalizeSideDockPinnedItem(null)).toBeNull();
  });

  it('keeps built-ins first and ignores pinned duplicates', () => {
    const items = mergeSideDockItems(
      [builtInItem],
      [
        {
          createdAt: '2026-06-02T00:00:00.000Z',
          icon: { type: 'builtin', name: 'docs' },
          id: 'docs-custom',
          label: 'Help Docs',
          target: { type: 'right-panel-resource', uri: 'nextclaw://docs' },
        },
        {
          createdAt: '2026-06-02T00:00:00.000Z',
          icon: { type: 'builtin', name: 'apps' },
          id: 'apps-copy',
          label: 'Apps',
          target: { type: 'right-panel-resource', uri: 'nextclaw://apps' },
        },
      ],
    );

    expect(items.map((item) => item.id)).toEqual(['apps', 'docs-custom']);
    expect(items[1]?.removable).toBe(true);
  });
});
