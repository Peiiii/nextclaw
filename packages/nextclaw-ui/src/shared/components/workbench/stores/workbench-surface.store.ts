import { ViewMemoryStorage } from "@/shared/lib/navigation-history";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_WORKBENCH_SURFACE,
  GLOBAL_WORKBENCH_SURFACE,
  type WorkbenchSurfaceState,
} from "@/shared/components/workbench/types/workbench-surface.types";

function restoreSurfaces(
  value: unknown,
): Record<string, WorkbenchSurfaceState> {
  if (
    !value ||
    typeof value !== "object" ||
    !("surfaces" in value) ||
    !value.surfaces ||
    typeof value.surfaces !== "object"
  )
    return {};
  const result: Record<string, WorkbenchSurfaceState> = {};
  for (const [id, candidate] of Object.entries(value.surfaces).slice(-64)) {
    if (!candidate || typeof candidate !== "object") continue;
    const { placement, rect } = candidate;
    if (
      (placement !== "docked" && placement !== "floating") ||
      !rect ||
      !["x", "y", "w", "h"].every(
        (key) => typeof rect[key] === "number" && Number.isFinite(rect[key]),
      )
    )
      continue;
    result[id] = { ...DEFAULT_WORKBENCH_SURFACE, placement, rect };
  }
  return result;
}

function initialSurfaces(): Record<string, WorkbenchSurfaceState> {
  // One-way import of the former browser-only placement. New writes have one owner.
  try {
    const legacy = JSON.parse(
      window.localStorage.getItem("nextclaw.doc-browser.state") ?? "null",
    );
    if (legacy?.state?.snapshot?.mode === "floating")
      return {
        [GLOBAL_WORKBENCH_SURFACE]: {
          ...DEFAULT_WORKBENCH_SURFACE,
          placement: "floating",
        },
      };
  } catch {
    /* Storage may be unavailable. The default dock remains usable. */
  }
  return {};
}

export const useWorkbenchSurfaceStore = create<{
  surfaces: Record<string, WorkbenchSurfaceState>;
  visibleSurfaceIds: string[];
}>()(
  persist(
    () => ({ surfaces: initialSurfaces(), visibleSurfaceIds: [] as string[] }),
    {
      name: "nextclaw.workbench.layout",
      version: 1,
      storage: createJSONStorage(() => new ViewMemoryStorage()),
      partialize: ({ surfaces }) => ({
        surfaces: Object.fromEntries(
          Object.entries(surfaces)
            .slice(-64)
            .map(([id, state]) => [
              id,
              { ...state, minimized: false, maximized: false, layer: 0 },
            ]),
        ),
      }),
      merge: (persisted, current) => ({
        ...current,
        surfaces: { ...current.surfaces, ...restoreSurfaces(persisted) },
      }),
    },
  ),
);
