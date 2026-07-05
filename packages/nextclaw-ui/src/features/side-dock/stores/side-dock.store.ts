import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SideDockPinnedItem } from '@/features/side-dock/types/side-dock.types';
import { normalizeSideDockPinnedItems } from '@/features/side-dock/utils/side-dock-item.utils';

const SIDE_DOCK_STORAGE_KEY = 'nextclaw.side-dock.state';
const SIDE_DOCK_STORAGE_VERSION = 1;

type SideDockStore = {
  isVisible: boolean;
  pinnedItems: SideDockPinnedItem[];
  setVisible: (isVisible: boolean) => void;
  setPinnedItems: (items: SideDockPinnedItem[]) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

export const useSideDockStore = create<SideDockStore>()(
  persist(
    (set) => ({
      isVisible: true,
      pinnedItems: [],
      setVisible: (isVisible) => set({ isVisible }),
      setPinnedItems: (items) => set({ pinnedItems: normalizeSideDockPinnedItems(items) }),
    }),
    {
      name: SIDE_DOCK_STORAGE_KEY,
      version: SIDE_DOCK_STORAGE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        isVisible: state.isVisible,
        pinnedItems: state.pinnedItems,
      }),
      merge: (persistedState, currentState) => {
        const pinnedItems = isRecord(persistedState)
          ? normalizeSideDockPinnedItems(persistedState.pinnedItems)
          : [];
        const isVisible = isRecord(persistedState) && typeof persistedState.isVisible === 'boolean'
          ? persistedState.isVisible
          : true;
        return {
          ...currentState,
          isVisible,
          pinnedItems,
        };
      },
    },
  ),
);
