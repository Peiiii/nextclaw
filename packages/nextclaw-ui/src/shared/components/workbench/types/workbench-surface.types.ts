export type WorkbenchPlacement = "docked" | "floating";
export type WorkbenchRect = { x: number; y: number; w: number; h: number };
export type WorkbenchResizeEdge =
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";
export type WorkbenchViewport = { width: number; height: number };

/** Presentation only. Resources, tabs, drafts and execution remain with their domain owners. */
export type WorkbenchSurfaceState = {
  placement: WorkbenchPlacement;
  minimized: boolean;
  maximized: boolean;
  rect: WorkbenchRect;
  layer: number;
};

export const GLOBAL_WORKBENCH_SURFACE = "global-resources";
export const SESSION_WORKBENCH_SURFACE = "floating-conversation";

export const DEFAULT_WORKBENCH_SURFACE: WorkbenchSurfaceState = {
  placement: "docked",
  minimized: false,
  maximized: false,
  rect: { x: 80, y: 80, w: 560, h: 640 },
  layer: 0,
};
