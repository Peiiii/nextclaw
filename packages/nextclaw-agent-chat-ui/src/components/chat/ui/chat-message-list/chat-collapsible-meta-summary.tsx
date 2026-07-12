import type { MouseEvent, ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";

type MetaOpenGroup = "process" | "tool-activity" | "reasoning";

const OPEN_ICON_CLASS: Record<MetaOpenGroup, { closed: string; open: string }> = {
  process: {
    closed: "group-open/process:hidden",
    open: "group-open/process:block",
  },
  "tool-activity": {
    closed: "group-open/tool-activity:hidden",
    open: "group-open/tool-activity:block",
  },
  reasoning: {
    closed: "group-open/reasoning:hidden",
    open: "group-open/reasoning:block",
  },
};

/**
 * Shared collapsible meta-row for process / tool-group / reasoning summaries.
 * Keeps chevron size, gap, and baseline alignment consistent across chat process UI.
 */
export function ChatCollapsibleMetaSummary({
  label,
  openGroup,
  className,
  labelClassName,
  onClick,
}: {
  label: ReactNode;
  openGroup: MetaOpenGroup;
  className?: string;
  labelClassName?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}) {
  const iconClass = OPEN_ICON_CLASS[openGroup];

  return (
    <summary
      className={cn(
        "flex cursor-pointer list-none items-center gap-1.5 py-0.5 text-xs font-medium leading-4 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 [&::-webkit-details-marker]:hidden",
        className,
      )}
      onClick={onClick}
    >
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-muted-foreground">
        <ChevronRight
          className={cn("h-3.5 w-3.5", iconClass.closed)}
          strokeWidth={2.5}
        />
        <ChevronDown
          className={cn("hidden h-3.5 w-3.5", iconClass.open)}
          strokeWidth={2.5}
        />
      </span>
      <span className={cn("min-w-0 truncate leading-4", labelClassName)}>{label}</span>
    </summary>
  );
}
