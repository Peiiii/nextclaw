import { useWorkbenchSurfaceStore } from "@/shared/components/workbench/stores/workbench-surface.store";
import {
  DEFAULT_WORKBENCH_SURFACE,
  type WorkbenchPlacement,
  type WorkbenchRect,
  type WorkbenchResizeEdge,
  type WorkbenchSurfaceState,
  type WorkbenchViewport,
} from "@/shared/components/workbench/types/workbench-surface.types";
import {
  constrainWorkbenchRect,
  resizeWorkbenchRect,
} from "@/shared/components/workbench/utils/workbench-surface-geometry.utils";

export class WorkbenchSurfaceManager {
  isVisible = (id: string): boolean =>
    useWorkbenchSurfaceStore.getState().visibleSurfaceIds.includes(id);

  setVisible = (id: string, visible: boolean): void => {
    useWorkbenchSurfaceStore.setState(({ visibleSurfaceIds }) => ({
      visibleSurfaceIds: visible
        ? [...new Set([...visibleSurfaceIds, id])]
        : visibleSurfaceIds.filter((key) => key !== id),
    }));
  };

  get = (id: string): WorkbenchSurfaceState =>
    useWorkbenchSurfaceStore.getState().surfaces[id] ??
    DEFAULT_WORKBENCH_SURFACE;

  private update = (
    id: string,
    patch: Partial<WorkbenchSurfaceState>,
  ): void => {
    useWorkbenchSurfaceStore.setState(({ surfaces }) => ({
      surfaces: { ...surfaces, [id]: { ...this.get(id), ...patch } },
    }));
  };

  place = (id: string, placement: WorkbenchPlacement): void => {
    this.update(id, { placement, minimized: false, maximized: false });
    this.focus(id);
  };

  minimize = (id: string): void =>
    this.update(id, { minimized: true, maximized: false });
  restore = (id: string): void => this.update(id, { minimized: false });
  toggleMaximize = (id: string): void => {
    this.update(id, { maximized: !this.get(id).maximized, minimized: false });
    this.focus(id);
  };

  focus = (id: string): void => {
    const { surfaces } = useWorkbenchSurfaceStore.getState();
    const ids = Object.keys(surfaces).sort(
      (left, right) => surfaces[left].layer - surfaces[right].layer,
    );
    if (ids.at(-1) === id && this.get(id).layer > 0) return;
    const ordered = [...ids.filter((key) => key !== id), id];
    useWorkbenchSurfaceStore.setState({
      surfaces: Object.fromEntries(
        ordered.map((key, index) => [
          key,
          { ...this.get(key), layer: index + 1 },
        ]),
      ),
    });
  };

  reset = (id: string): void => {
    useWorkbenchSurfaceStore.setState(({ surfaces }) => {
      const next = { ...surfaces };
      delete next[id];
      return { surfaces: next };
    });
  };

  constrain = (id: string, viewport: WorkbenchViewport): void => {
    const current = this.get(id).rect;
    const rect = constrainWorkbenchRect(current, viewport);
    if (
      Object.keys(rect).some(
        (key) =>
          rect[key as keyof WorkbenchRect] !==
          current[key as keyof WorkbenchRect],
      )
    )
      this.update(id, { rect });
  };

  move = (
    id: string,
    start: WorkbenchRect,
    dx: number,
    dy: number,
    viewport: WorkbenchViewport,
  ): void => {
    this.update(id, {
      rect: constrainWorkbenchRect(
        { ...start, x: start.x + dx, y: start.y + dy },
        viewport,
      ),
    });
  };

  resize = (
    id: string,
    start: WorkbenchRect,
    edge: WorkbenchResizeEdge,
    dx: number,
    dy: number,
    viewport: WorkbenchViewport,
  ): void => {
    this.update(id, {
      rect: resizeWorkbenchRect(start, edge, dx, dy, viewport),
    });
  };
}

export const workbenchSurfaceManager = new WorkbenchSurfaceManager();
