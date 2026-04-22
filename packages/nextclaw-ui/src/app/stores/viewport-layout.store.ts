import { create } from "zustand";

export type ViewportLayoutMode = "mobile" | "desktop";

export type ViewportLayoutSnapshot = {
  mode: ViewportLayoutMode;
  width: number | null;
};

export const MOBILE_VIEWPORT_MAX_WIDTH = 767;

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
    typeof window === "undefined" ? null : window.innerWidth ?? null;
  return {
    mode: resolveViewportLayoutMode(width),
    width,
  };
}

export const useViewportLayoutStore = create<ViewportLayoutSnapshot>(() =>
  createInitialViewportLayoutSnapshot(),
);
