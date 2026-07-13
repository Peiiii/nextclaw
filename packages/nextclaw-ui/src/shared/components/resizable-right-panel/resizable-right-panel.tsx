import { useRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/shared/lib/utils";

type ResizableRightPanelProps = ComponentPropsWithoutRef<"aside"> & {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  onWidthCommit?: (width: number) => void;
  overlay?: boolean;
  overlayScope?: "viewport" | "container";
  width?: number;
};

export function ResizableRightPanel({
  children,
  className,
  style,
  defaultWidth = 420,
  minWidth = 320,
  maxWidth = 860,
  onWidthCommit,
  overlay = false,
  overlayScope = "viewport",
  width: controlledWidth,
  ...props
}: ResizableRightPanelProps) {
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const widthRef = useRef(controlledWidth ?? defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const [uncontrolledWidth, setUncontrolledWidth] = useState(defaultWidth);
  const width = dragWidth ?? controlledWidth ?? uncontrolledWidth;
  const overlayClassName = overlay
    ? overlayScope === "container"
      ? "absolute inset-0 z-30"
      : "fixed inset-0 z-40"
    : "border-l border-border";

  const onResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (overlay) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsResizing(true);
    widthRef.current = width;
    resizeRef.current = { startX: event.clientX, startWidth: width };
    const onMove = (moveEvent: PointerEvent) => {
      const resizing = resizeRef.current;
      if (!resizing) return;
      const nextWidth = resizing.startWidth + resizing.startX - moveEvent.clientX;
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, nextWidth));
      widthRef.current = clampedWidth;
      setDragWidth(clampedWidth);
    };
    const onUp = () => {
      if (controlledWidth === undefined) {
        setUncontrolledWidth(widthRef.current);
      }
      onWidthCommit?.(widthRef.current);
      setDragWidth(null);
      setIsResizing(false);
      resizeRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <aside
      {...props}
      className={cn(
        "relative flex h-full min-h-0 shrink-0 overflow-hidden bg-card text-card-foreground",
        overlayClassName,
        className,
      )}
      style={overlay ? style : { ...style, width }}
    >
      {!overlay ? (
        <div className="absolute left-0 top-0 z-20 h-full w-3 cursor-ew-resize transition-colors hover:bg-primary/10" data-testid="resizable-right-panel-handle" onPointerDown={onResizeStart} />
      ) : null}
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">{children}</div>
      {isResizing ? <div className="absolute inset-0 z-10 cursor-ew-resize" data-testid="resizable-right-panel-resize-shield" /> : null}
    </aside>
  );
}
