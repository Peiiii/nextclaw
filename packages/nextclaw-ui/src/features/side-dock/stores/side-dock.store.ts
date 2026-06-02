import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SideDockPinnedItem } from '@/features/side-dock/types/side-dock.types';
import { normalizeSideDockPinnedItems } from '@/features/side-dock/utils/side-dock-item.utils';

const SIDE_DOCK_STORAGE_KEY = 'nextclaw.side-dock.state';
const SIDE_DOCK_STORAGE_VERSION = 1;

type SideDockStore = {
  pinnedItems: SideDockPinnedItem[];
  setPinnedItems: (items: SideDockPinnedItem[]) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export const useSideDockStore = create<SideDockStore>()(
  persist(
    (set) => ({
      pinnedItems: [],
      setPinnedItems: (items) => set({ pinnedItems: normalizeSideDockPinnedItems(items) }),
    }),
    {
      name: SIDE_DOCK_STORAGE_KEY,
      version: SIDE_DOCK_STORAGE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        pinnedItems: state.pinnedItems,
      }),
      merge: (persistedState, currentState) => {
        const pinnedItems = isRecord(persistedState)
          ? normalizeSideDockPinnedItems(persistedState.pinnedItems)
          : [];
        return {
          ...currentState,
          pinnedItems,
        };
      },
    },
  ),
);
