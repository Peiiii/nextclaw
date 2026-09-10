import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useWorkbenchSurfaceStore } from "./stores/workbench-surface.store";
import {
  DEFAULT_WORKBENCH_SURFACE,
  type WorkbenchResizeEdge,
} from "./types/workbench-surface.types";
import type { WorkbenchSurfaceManager } from "./managers/workbench-surface.manager";
import { WorkbenchSurfaceToolbar } from "./workbench-surface-toolbar";
import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";

type WorkbenchSurfaceProps = {
  id: string;
  manager: WorkbenchSurfaceManager;
  title: string;
  children: ReactNode;
  navigation?: ReactNode;
  icon?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
  onPlace?: () => void;
  onOpenMain?: () => void;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthCommit?: (width: number) => void;
  fullscreen?: boolean;
  hidden?: boolean;
  testId?: string;
  className?: string;
  focusOnOpen?: boolean;
};

const EDGE_CLASSES: Record<WorkbenchResizeEdge, string> = {
  left: "left-0 top-3 bottom-3 w-1.5 cursor-ew-resize",
  right: "right-0 top-3 bottom-3 w-1.5 cursor-ew-resize",
  top: "top-0 left-3 right-3 h-1.5 cursor-ns-resize",
  bottom: "bottom-0 left-3 right-3 h-1.5 cursor-ns-resize",
  "top-left": "left-0 top-0 h-3 w-3 cursor-nwse-resize",
  "top-right": "right-0 top-0 h-3 w-3 cursor-nesw-resize",
  "bottom-left": "left-0 bottom-0 h-3 w-3 cursor-nesw-resize",
  "bottom-right": "right-0 bottom-0 h-3 w-3 cursor-nwse-resize",
};
const viewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});
const blocksDrag = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(
    target.closest(
      'button, a, input, textarea, select, [role="menu"], [data-compact-tab-item]',
    ),
  );

/** One stable DOM parent across dock/float/maximize/collapse. Content never owns window mechanics. */
export function WorkbenchSurface({
  id,
  manager,
  title,
  icon,
  navigation,
  children,
  onClose,
  closeLabel = t("workbenchCloseView"),
  onPlace,
  onOpenMain,
  width = 480,
  minWidth = 320,
  maxWidth = 960,
  onWidthCommit,
  fullscreen = false,
  hidden = false,
  testId,
  className,
  focusOnOpen = false,
}: WorkbenchSurfaceProps) {
  const state = useWorkbenchSurfaceStore(
    (store) => store.surfaces[id] ?? DEFAULT_WORKBENCH_SURFACE,
  );
  const panelRef = useRef<HTMLElement>(null);
  const interactionCleanup = useRef<(() => void) | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [compact, setCompact] = useState(() => window.innerWidth < 768);
  const [interacting, setInteracting] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const isCompact = compact || fullscreen;
  const floating = state.placement === "floating";
  const overlay = isCompact || state.maximized;

  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (focusOnOpen) panelRef.current?.focus();
    const onResize = () => {
      setCompact(window.innerWidth < 768);
      manager.constrain(id, viewport());
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      interactionCleanup.current?.();
    };
  }, [id, manager, focusOnOpen]);

  useEffect(() => {
    manager.setVisible(id, !hidden);
    return () => manager.setVisible(id, false);
  }, [hidden, id, manager]);

  const focusControl = () => panelRef.current?.focus();
  const close = () => {
    onClose();
    if (
      openerRef.current?.isConnected &&
      !panelRef.current?.contains(openerRef.current)
    )
      openerRef.current.focus();
  };

  const startInteraction = (
    event: ReactPointerEvent<HTMLElement>,
    edge?: WorkbenchResizeEdge | "dock",
  ) => {
    if (
      event.button !== 0 ||
      overlay ||
      state.minimized ||
      (!edge && blocksDrag(event.target))
    )
      return;
    if (!edge && !floating) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    interactionCleanup.current?.();
    manager.focus(id);
    setInteracting(true);
    const start = {
      x: event.clientX,
      y: event.clientY,
      rect: state.rect,
      width,
    };
    let nextWidth = width;
    const move = (next: PointerEvent) => {
      const dx = next.clientX - start.x;
      const dy = next.clientY - start.y;
      if (edge === "dock") {
        nextWidth = Math.max(
          Math.min(minWidth, window.innerWidth),
          Math.min(maxWidth, window.innerWidth, start.width - dx),
        );
        setDragWidth(nextWidth);
      } else if (edge) manager.resize(id, start.rect, edge, dx, dy, viewport());
      else manager.move(id, start.rect, dx, dy, viewport());
    };
    const cleanup = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    const end = () => {
      cleanup();
      interactionCleanup.current = null;
      setInteracting(false);
      setDragWidth(null);
      if (edge === "dock") onWidthCommit?.(nextWidth);
    };
    interactionCleanup.current = cleanup;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  const minimizedIndex = useWorkbenchSurfaceStore((store) =>
    store.visibleSurfaceIds
      .filter((key) => store.surfaces[key]?.minimized)
      .sort()
      .indexOf(id),
  );
  const layer = useWorkbenchSurfaceStore(
    (store) =>
      store.visibleSurfaceIds.filter(
        (key) => (store.surfaces[key]?.layer ?? 0) <= state.layer,
      ).length,
  );
  const style: CSSProperties = state.minimized
    ? {
        position: "fixed",
        bottom: 12 + Math.max(0, minimizedIndex) * 48,
        right: 12,
        width: "min(360px, calc(100vw - 24px))",
        zIndex: 50 + layer,
      }
    : overlay
      ? {
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100dvh",
          zIndex: 50 + layer,
        }
      : floating
        ? {
            position: "fixed",
            left: state.rect.x,
            top: state.rect.y,
            width: state.rect.w,
            height: state.rect.h,
            zIndex: 50 + layer,
          }
        : { width: dragWidth ?? width, height: "100%" };

  return (
    <aside
      ref={panelRef}
      role="region"
      aria-label={title}
      tabIndex={-1}
      hidden={hidden}
      data-testid={testId}
      data-workbench-surface={id}
      data-placement={state.placement}
      data-maximized={state.maximized || undefined}
      data-minimized={state.minimized || undefined}
      data-theme-surface="workspace-panel"
      className={cn(
        "relative min-h-0 min-w-0 shrink-0 flex-col overflow-hidden bg-card text-card-foreground outline-none",
        hidden ? "hidden" : "flex",
        (floating || state.minimized) && !overlay
          ? "rounded-xl border border-border shadow-2xl"
          : "border-l border-border",
        className,
      )}
      style={style}
      onPointerDownCapture={() => manager.focus(id)}
      onFocusCapture={() => manager.focus(id)}
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          event.nativeEvent.isComposing
        )
          return;
        if (state.maximized) {
          event.stopPropagation();
          manager.toggleMaximize(id);
          focusControl();
        } else if (floating && !state.minimized) {
          event.stopPropagation();
          manager.minimize(id);
          focusControl();
        }
      }}
    >
      <header
        className="flex min-h-10 shrink-0 select-none items-center gap-2 border-b border-border/60 bg-muted/30 px-2"
        style={{ touchAction: floating ? "none" : undefined }}
        onPointerDown={(event) => startInteraction(event)}
        onDoubleClick={(event) => {
          if (!isCompact && !blocksDrag(event.target))
            manager.toggleMaximize(id);
        }}
      >
        <div
          hidden={state.minimized}
          className={cn(
            "min-w-0 flex-1",
            state.minimized || !navigation ? "hidden" : "flex",
          )}
        >
          {navigation}
        </div>
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 px-1 text-xs font-medium",
            floating && !overlay && "cursor-grab active:cursor-grabbing",
            navigation && !state.minimized && "hidden",
          )}
        >
          {icon}
          <span className="truncate">{title}</span>
        </span>
        <WorkbenchSurfaceToolbar
          state={state}
          compact={isCompact}
          onPlace={
            onPlace ??
            (() => manager.place(id, floating ? "docked" : "floating"))
          }
          onMinimize={() => {
            manager.minimize(id);
            focusControl();
          }}
          onRestore={() => manager.restore(id)}
          onMaximize={() => manager.toggleMaximize(id)}
          onClose={close}
          closeLabel={closeLabel}
          onOpenMain={onOpenMain}
        />
      </header>
      <div
        hidden={state.minimized}
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col",
          state.minimized ? "hidden" : "flex",
        )}
      >
        {children}
      </div>
      {!overlay && !state.minimized && (
        <WorkbenchResizeHandles
          floating={floating}
          width={dragWidth ?? width}
          minWidth={minWidth}
          maxWidth={maxWidth}
          onWidthCommit={onWidthCommit}
          onPointerDown={startInteraction}
        />
      )}
      {interacting && (
        <div
          className="fixed inset-0 z-30"
          data-workbench-interaction-shield=""
        />
      )}
    </aside>
  );
}

function WorkbenchResizeHandles({
  floating,
  width,
  minWidth,
  maxWidth,
  onWidthCommit,
  onPointerDown,
}: {
  floating: boolean;
  width: number;
  minWidth: number;
  maxWidth: number;
  onWidthCommit?: (width: number) => void;
  onPointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    edge: WorkbenchResizeEdge | "dock",
  ) => void;
}) {
  return floating ? (
    <>
      {(Object.entries(EDGE_CLASSES) as [WorkbenchResizeEdge, string][]).map(
        ([edge, classes]) => (
          <div
            key={edge}
            data-workbench-resize={edge}
            className={cn("absolute z-20 touch-none", classes)}
            onPointerDown={(event) => onPointerDown(event, edge)}
          />
        ),
      )}
    </>
  ) : onWidthCommit ? (
    <div
      role="separator"
      aria-label={t("workbenchResize")}
      aria-orientation="vertical"
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      tabIndex={0}
      data-testid="resizable-right-panel-handle"
      className="absolute bottom-0 left-0 top-0 z-20 w-1.5 cursor-ew-resize touch-none hover:bg-primary/20 focus-visible:bg-primary/30 focus-visible:outline-none"
      onPointerDown={(event) => onPointerDown(event, "dock")}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const next =
          event.key === "Home"
            ? minWidth
            : event.key === "End"
              ? maxWidth
              : width + (event.key === "ArrowLeft" ? 24 : -24);
        onWidthCommit(
          Math.max(minWidth, Math.min(maxWidth, window.innerWidth, next)),
        );
      }}
    />
  ) : null;
}
