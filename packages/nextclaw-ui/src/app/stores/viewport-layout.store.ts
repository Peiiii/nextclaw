import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ViewportLayoutMode = "mobile" | "desktop";

export type ViewportLayoutSnapshot = {
  mode: ViewportLayoutMode;
  width: number | null;
  isSidebarCollapsed: boolean;
};

export const MOBILE_VIEWPORT_MAX_WIDTH = 767;
const VIEWPORT_LAYOUT_STORAGE_KEY = "nextclaw.app.viewport-layout";
const VIEWPORT_LAYOUT_STORAGE_VERSION = 1;

type PersistedViewportLayoutStore = {
  isSidebarCollapsed?: unknown;
};

export function resolveViewportLayoutMode(
  width: number | null | undefined,
): ViewportLayoutMode {
  if (typeof width !== "number" || !Number.isFinite(width)) {
    return "desktop";
  }
  return width <= MOBILE_VIEWPORT_MAX_WIDTH ? "mobile" : "desktop";
}

export function createInitialViewportLayoutSnapshot(): ViewportLayoutSnapshot {
  const width =
    typeof window === "undefined" ? null : (window.innerWidth ?? null);
  return {
    mode: resolveViewportLayoutMode(width),
    width,
    isSidebarCollapsed: false,
  };
}

function resolvePersistedSidebarCollapsed(
  persistedState: unknown,
): boolean | null {
  if (!persistedState || typeof persistedState !== "object") {
    return null;
  }
  const { isSidebarCollapsed } = persistedState as PersistedViewportLayoutStore;
  return typeof isSidebarCollapsed === "boolean" ? isSidebarCollapsed : null;
}

export const useViewportLayoutStore = create<ViewportLayoutSnapshot>()(
  persist(() => createInitialViewportLayoutSnapshot(), {
    name: VIEWPORT_LAYOUT_STORAGE_KEY,
    version: VIEWPORT_LAYOUT_STORAGE_VERSION,
    storage: createJSONStorage(() => window.localStorage),
    partialize: (state): PersistedViewportLayoutStore => ({
      isSidebarCollapsed: state.isSidebarCollapsed,
    }),
    merge: (persistedState, currentState) => {
      const isSidebarCollapsed =
        resolvePersistedSidebarCollapsed(persistedState);
      return isSidebarCollapsed === null
        ? currentState
        : {
            ...currentState,
            isSidebarCollapsed,
          };
    },
  }),
);
