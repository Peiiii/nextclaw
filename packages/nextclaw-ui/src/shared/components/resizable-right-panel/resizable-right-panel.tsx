import { useRef, useState, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/shared/lib/utils";

type ResizableRightPanelProps = ComponentPropsWithoutRef<"aside"> & { defaultWidth?: number; minWidth?: number; maxWidth?: number; overlay?: boolean };

export function ResizableRightPanel({ children, className, style, defaultWidth = 420, minWidth = 320, maxWidth = 860, overlay = false, ...props }: ResizableRightPanelProps) {
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [width, setWidth] = useState(defaultWidth);

  const onResizeStart = (event: React.MouseEvent) => {
    if (overlay) return;
    event.preventDefault();
    event.stopPropagation();
    setIsResizing(true);
    resizeRef.current = { startX: event.clientX, startWidth: width };
    const onMove = (moveEvent: MouseEvent) => {
      const resizing = resizeRef.current;
      if (!resizing) return;
      const nextWidth = resizing.startWidth + resizing.startX - moveEvent.clientX;
      setWidth(Math.max(minWidth, Math.min(maxWidth, nextWidth)));
    };
    const onUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <aside
      {...props}
      className={cn("relative flex h-full min-h-0 shrink-0 overflow-hidden bg-white", overlay ? "fixed inset-0 z-40" : "border-l border-gray-200", className)}
      style={overlay ? style : { ...style, width }}
    >
      {!overlay ? (
        <div className="absolute left-0 top-0 z-20 h-full w-1.5 cursor-ew-resize transition-colors hover:bg-primary/10" data-testid="resizable-right-panel-handle" onMouseDown={onResizeStart} />
      ) : null}
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">{children}</div>
      {isResizing ? <div className="absolute inset-0 z-10" /> : null}
    </aside>
  );
}
