import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PetDockLayoutPreferences } from '@/features/pet/types/pet-view.types';

const PET_DOCK_STORAGE_KEY = 'nextclaw.pet-dock.state';
const PET_DOCK_STORAGE_VERSION = 1;

type PetDockStore = PetDockLayoutPreferences & {
  setExpanded: (expanded: boolean) => void;
  moveTo: (xPercent: number, yPercent: number) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function readPercent(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  // 越界持久化值视为异常数据，回退默认位置而非 clamp
  return value < 0 || value > 100 ? fallback : value;
}

type PetDockPersistedLayout = {
  expanded?: unknown;
  xPercent?: unknown;
  yPercent?: unknown;
};

/** 合并持久化布局（纯函数，单测可直接验证）。泛型保留 currentState 的完整结构（含 actions）。 */
export function mergePetDockPersistedLayout<S extends PetDockLayoutPreferences>(
  persistedState: unknown,
  currentState: S,
): S {
  if (!isRecord(persistedState)) {
    return currentState;
  }
  return {
    ...currentState,
    expanded:
      typeof persistedState.expanded === 'boolean'
        ? persistedState.expanded
        : false,
    xPercent: readPercent(persistedState.xPercent, currentState.xPercent),
    yPercent: readPercent(persistedState.yPercent, currentState.yPercent),
  };
}

export const usePetDockStore = create<PetDockStore>()(
  persist(
    (set) => ({
      expanded: false,
      xPercent: 92,
      yPercent: 84,
      setExpanded: (expanded) => set({ expanded }),
      moveTo: (xPercent, yPercent) => set({ xPercent, yPercent }),
    }),
    {
      name: PET_DOCK_STORAGE_KEY,
      version: PET_DOCK_STORAGE_VERSION,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        expanded: state.expanded,
        xPercent: state.xPercent,
        yPercent: state.yPercent,
      }),
      merge: (persistedState, currentState) =>
        mergePetDockPersistedLayout(persistedState, currentState),
    },
  ),
);
