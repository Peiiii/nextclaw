import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;

export type ChatMessagePreviewAction = {
  disabled?: boolean;
  icon: ReactNode;
  id: string;
  label: string;
  onSelect: () => void;
};

export function ChatMessagePreviewToolbar({
  actions,
  className,
}: {
  actions: readonly ChatMessagePreviewAction[];
  className?: string;
}) {
  return (
    <div
      data-chat-message-preview-toolbar="true"
      className={cn(
        "absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg bg-black/55 p-1 text-white opacity-80 shadow-lg backdrop-blur-md transition-opacity duration-150 hover:opacity-100 focus-within:opacity-100",
        className,
      )}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          aria-label={action.label}
          title={action.label}
          disabled={action.disabled}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            action.onSelect();
          }}
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}

type ViewTransform = { scale: number; x: number; y: number };

type DragState = Pick<ViewTransform, "x" | "y"> & {
  pointerId: number;
  startX: number;
  startY: number;
};

export function ChatMessageLightbox({
  actions = [],
  children,
  closeLabel,
  label,
  onClose,
  resetZoomLabel = "Reset zoom",
  zoomInLabel = "Zoom in",
  zoomOutLabel = "Zoom out",
}: {
  actions?: readonly ChatMessagePreviewAction[];
  children: ReactNode;
  closeLabel: string;
  label: string;
  onClose: () => void;
  resetZoomLabel?: string;
  zoomInLabel?: string;
  zoomOutLabel?: string;
}) {
  const dragState = useRef<DragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [view, setView] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });

  const resetZoom = useCallback(() => {
    setView({ scale: 1, x: 0, y: 0 });
  }, []);

  const changeScale = useCallback((
    nextScale: number | ((scale: number) => number),
    anchor: { x: number; y: number } = { x: 0, y: 0 },
  ) => {
    setView((currentView) => {
      const requestedScale =
        typeof nextScale === "function"
          ? nextScale(currentView.scale)
          : nextScale;
      const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, requestedScale));
      if (clampedScale <= 1) {
        return { scale: clampedScale, x: 0, y: 0 };
      }
      const scaleRatio = clampedScale / currentView.scale;
      return {
        scale: clampedScale,
        x: anchor.x - (anchor.x - currentView.x) * scaleRatio,
        y: anchor.y - (anchor.y - currentView.y) * scaleRatio,
      };
    });
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        changeScale((currentScale) => currentScale + SCALE_STEP);
      } else if (event.key === "-") {
        event.preventDefault();
        changeScale((currentScale) => currentScale - SCALE_STEP);
      } else if (event.key === "0") {
        event.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [changeScale, onClose, resetZoom]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (view.scale <= 1 || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: view.x,
      y: view.y,
    };
    setIsDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setView((currentView) => ({
      ...currentView,
      x: drag.x + event.clientX - drag.startX,
      y: drag.y + event.clientY - drag.startY,
    }));
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragState.current = null;
    setIsDragging(false);
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    changeScale((currentScale) =>
      currentScale + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP),
      {
        x: event.clientX - bounds.left - bounds.width / 2,
        y: event.clientY - bounds.top - bounds.height / 2,
      },
    );
  };

  const zoomPercent = `${Math.round(view.scale * 100)}%`;
  const toolbarActions: ChatMessagePreviewAction[] = [
    ...actions,
    {
      id: "close",
      label: closeLabel,
      icon: <X className="h-4 w-4" strokeWidth={2} />,
      onSelect: onClose,
    },
  ];

  return createPortal(
    <div
      role="dialog"
      aria-label={label}
      aria-modal="true"
      className="fixed inset-0 z-[var(--z-modal,10050)] overflow-hidden bg-black/90 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <ChatMessagePreviewToolbar
        actions={toolbarActions}
        className="right-4 top-4 opacity-100"
      />
      <div
        data-chat-message-lightbox-viewport="true"
        className={cn(
          "absolute inset-0 flex touch-none select-none items-center justify-center overflow-hidden p-6 sm:p-12",
          view.scale > 1 && (isDragging ? "cursor-grabbing" : "cursor-grab"),
        )}
        onClick={(event) => event.stopPropagation()}
        onDoubleClick={() => {
          if (view.scale === 1) {
            changeScale(2);
          } else {
            resetZoom();
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onWheel={onWheel}
      >
        <div
          data-chat-message-lightbox-content="true"
          className={cn(
            "flex h-full w-full items-center justify-center will-change-transform",
            !isDragging && "transition-transform duration-150 ease-out",
          )}
          style={{
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})`,
          }}
        >
          {children}
        </div>
      </div>
      <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-xl bg-black/60 p-1 text-white shadow-xl backdrop-blur-md">
        <button
          type="button"
          aria-label={zoomOutLabel}
          title={zoomOutLabel}
          disabled={view.scale <= MIN_SCALE}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation();
            changeScale((currentScale) => currentScale - SCALE_STEP);
          }}
        >
          <Minus className="h-4 w-4" strokeWidth={2} />
        </button>
        <output
          aria-label={zoomPercent}
          className="inline-flex h-9 min-w-16 items-center justify-center px-2 text-xs font-medium tabular-nums"
        >
          {zoomPercent}
        </output>
        <button
          type="button"
          aria-label={zoomInLabel}
          title={zoomInLabel}
          disabled={view.scale >= MAX_SCALE}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation();
            changeScale((currentScale) => currentScale + SCALE_STEP);
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
        </button>
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-white/20" />
        <button
          type="button"
          aria-label={resetZoomLabel}
          title={resetZoomLabel}
          disabled={view.scale === 1 && view.x === 0 && view.y === 0}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/80 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation();
            resetZoom();
          }}
        >
          <RotateCcw className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
