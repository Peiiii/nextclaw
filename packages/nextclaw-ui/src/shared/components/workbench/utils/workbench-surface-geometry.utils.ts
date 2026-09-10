import type {
  WorkbenchRect,
  WorkbenchResizeEdge,
  WorkbenchViewport,
} from "@/shared/components/workbench/types/workbench-surface.types";

const MARGIN = 12;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function constrainWorkbenchRect(
  rect: WorkbenchRect,
  viewport: WorkbenchViewport,
): WorkbenchRect {
  const maxWidth = Math.max(1, viewport.width - MARGIN * 2);
  const maxHeight = Math.max(1, viewport.height - MARGIN * 2);
  const w = clamp(rect.w, Math.min(320, maxWidth), maxWidth);
  const h = clamp(rect.h, Math.min(240, maxHeight), maxHeight);
  return {
    w,
    h,
    x: clamp(rect.x, MARGIN, viewport.width - w - MARGIN),
    y: clamp(rect.y, MARGIN, viewport.height - h - MARGIN),
  };
}

export function resizeWorkbenchRect(
  rect: WorkbenchRect,
  edge: WorkbenchResizeEdge,
  dx: number,
  dy: number,
  viewport: WorkbenchViewport,
): WorkbenchRect {
  const parts = edge.split("-");
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  const x = parts.includes("left")
    ? clamp(rect.x + dx, MARGIN, right - Math.min(320, rect.w))
    : rect.x;
  const y = parts.includes("top")
    ? clamp(rect.y + dy, MARGIN, bottom - Math.min(240, rect.h))
    : rect.y;
  const w = parts.includes("right") ? rect.w + dx : right - x;
  const h = parts.includes("bottom") ? rect.h + dy : bottom - y;
  return constrainWorkbenchRect({ x, y, w, h }, viewport);
}
