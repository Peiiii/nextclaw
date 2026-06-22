import { useRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/shared/lib/utils";

type ResizableRightPanelProps = ComponentPropsWithoutRef<"aside"> & { defaultWidth?: number; minWidth?: number; maxWidth?: number; overlay?: boolean };

export function ResizableRightPanel({ children, className, style, defaultWidth = 420, minWidth = 320, maxWidth = 860, overlay = false, ...props }: ResizableRightPanelProps) {
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [width, setWidth] = useState(defaultWidth);

  const onResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (overlay) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsResizing(true);
    resizeRef.current = { startX: event.clientX, startWidth: width };
    const onMove = (moveEvent: PointerEvent) => {
      const resizing = resizeRef.current;
      if (!resizing) return;
      const nextWidth = resizing.startWidth + resizing.startX - moveEvent.clientX;
      setWidth(Math.max(minWidth, Math.min(maxWidth, nextWidth)));
    };
    const onUp = () => {
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
      className={cn("relative flex h-full min-h-0 shrink-0 overflow-hidden bg-card text-card-foreground", overlay ? "fixed inset-0 z-40" : "border-l border-border", className)}
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
