import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";

/**
 * Shared process-row metrics.
 * Collapsed process/tool rows should feel like ordinary body text lines.
 */
export const CHAT_PROCESS_LEADING_COL_CLASS =
  "inline-flex h-[1.15em] w-[1.15em] shrink-0 items-center justify-center text-current";

export const CHAT_PROCESS_META_ROW_CLASS =
  "group/process-row flex w-full min-w-0 items-center gap-1.5 py-0 text-[0.925rem] font-normal leading-[1.72] text-muted-foreground";

export function ChatProcessLeadingIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn(CHAT_PROCESS_LEADING_COL_CLASS, className)}>
      {children}
    </span>
  );
}

export function ChatProcessWorkflowRail({
  position,
}: {
  position: "single" | "first" | "middle" | "last";
}) {
  return (
    <span
      aria-hidden="true"
      data-tool-workflow-rail="true"
      className={cn(
        "pointer-events-none absolute left-[0.575em] w-px -translate-x-1/2 bg-border/70",
        position === "first"
          ? "bottom-0 top-[0.86em]"
          : position === "last"
            ? "top-0 h-[0.86em]"
            : "inset-y-0",
      )}
    />
  );
}

export function ChatProcessMetaRow({
  children,
  className,
  interactive = false,
  onClick,
  role,
  tabIndex,
  onKeyDown,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  role?: string;
  tabIndex?: number;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
}) {
  return (
    <div
      className={cn(
        CHAT_PROCESS_META_ROW_CLASS,
        interactive
          ? "cursor-pointer transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          : null,
        className,
      )}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
