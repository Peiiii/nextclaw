import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

const INLINE_CONTENT_MIN_HEIGHT = 240;

export function ChatInlineContentSurface({
  actions,
  children,
  contentHeight,
  isLoading = false,
}: {
  actions?: ReactNode;
  children: ReactNode;
  contentHeight?: number | null;
  isLoading?: boolean;
}) {
  return (
    <section
      className="group/inline-content relative my-2 w-full max-w-[48rem] overflow-visible"
      data-chat-inline-content-surface="true"
      data-chat-message-wide-content="true"
    >
      {actions ? (
        <div
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-10 -translate-x-1/2 pb-2 opacity-0 transition-opacity duration-150",
            "group-hover/inline-content:pointer-events-auto group-hover/inline-content:opacity-100 group-focus-within/inline-content:pointer-events-auto group-focus-within/inline-content:opacity-100",
          )}
          data-chat-inline-content-actions="true"
        >
          <div
            className="flex items-center gap-0.5 rounded-lg bg-background/95 p-0.5 shadow-md ring-1 ring-border/60 backdrop-blur-sm"
            data-chat-inline-content-actions-surface="true"
          >
            {actions}
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "h-[240px] min-h-[240px] max-h-[min(80vh,720px)] overflow-hidden rounded-lg",
          isLoading && "animate-pulse bg-muted/45",
        )}
        data-chat-inline-content-viewport="true"
        style={
          contentHeight
            ? { height: Math.max(INLINE_CONTENT_MIN_HEIGHT, contentHeight) }
            : undefined
        }
      >
        {children}
      </div>
    </section>
  );
}
