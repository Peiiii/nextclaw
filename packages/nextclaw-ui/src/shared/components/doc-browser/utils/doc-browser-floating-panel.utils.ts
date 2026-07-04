export type FloatingPanelRect = { x: number; y: number; w: number; h: number };
export type FloatingPanelResizeEdge =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

const FLOATING_PANEL_MARGIN = 40;
const FLOATING_PANEL_MIN_WIDTH = 360;
const FLOATING_PANEL_MIN_HEIGHT = 400;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function resizeEdgeIncludes(
  edge: FloatingPanelResizeEdge,
  side: 'left' | 'right' | 'top' | 'bottom',
): boolean {
  return edge.split('-').includes(side);
}

export function createInitialFloatingPanelRect(): FloatingPanelRect {
  return {
    x: Math.max(FLOATING_PANEL_MARGIN, window.innerWidth - 520),
    y: 80,
    w: 480,
    h: 600,
  };
}

export function moveFloatingPanelRect(
  startRect: FloatingPanelRect,
  dx: number,
  dy: number,
): FloatingPanelRect {
  return {
    ...startRect,
    x: clamp(
      startRect.x + dx,
      FLOATING_PANEL_MARGIN,
      window.innerWidth - FLOATING_PANEL_MARGIN - startRect.w,
    ),
    y: clamp(
      startRect.y + dy,
      FLOATING_PANEL_MARGIN,
      window.innerHeight - FLOATING_PANEL_MARGIN - startRect.h,
    ),
  };
}

export function resizeFloatingPanelRect(
  edge: FloatingPanelResizeEdge,
  startRect: FloatingPanelRect,
  dx: number,
  dy: number,
): FloatingPanelRect {
  const startRight = startRect.x + startRect.w;
  const startBottom = startRect.y + startRect.h;
  const nextLeft = resizeEdgeIncludes(edge, 'left')
    ? clamp(startRect.x + dx, FLOATING_PANEL_MARGIN, startRight - FLOATING_PANEL_MIN_WIDTH)
    : startRect.x;
  const nextRight = resizeEdgeIncludes(edge, 'right')
    ? clamp(startRight + dx, nextLeft + FLOATING_PANEL_MIN_WIDTH, window.innerWidth - FLOATING_PANEL_MARGIN)
    : startRight;
  const nextTop = resizeEdgeIncludes(edge, 'top')
    ? clamp(startRect.y + dy, FLOATING_PANEL_MARGIN, startBottom - FLOATING_PANEL_MIN_HEIGHT)
    : startRect.y;
  const nextBottom = resizeEdgeIncludes(edge, 'bottom')
    ? clamp(startBottom + dy, nextTop + FLOATING_PANEL_MIN_HEIGHT, window.innerHeight - FLOATING_PANEL_MARGIN)
    : startBottom;

  return {
    x: nextLeft,
    y: nextTop,
    w: nextRight - nextLeft,
    h: nextBottom - nextTop,
  };
}
