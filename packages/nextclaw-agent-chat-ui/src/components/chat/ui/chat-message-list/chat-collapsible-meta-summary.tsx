import type { MouseEvent, ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import {
  CHAT_PROCESS_META_ROW_CLASS,
  ChatProcessLeadingIcon,
} from "./chat-process-meta-row";

type MetaOpenGroup = "process" | "tool-activity" | "reasoning";

/**
 * Shared collapsible meta-row for process / tool-group / reasoning summaries.
 * Rendered as a plain button-like row (not <summary>) so browsers never inject
 * a default disclosure label such as "详情" / "Details".
 */
export function ChatCollapsibleMetaSummary({
  label,
  openGroup,
  open = false,
  icon: Icon,
  className,
  leadingIconClassName,
  labelClassName,
  onClick,
}: {
  label: ReactNode;
  openGroup: MetaOpenGroup;
  open?: boolean;
  icon?: LucideIcon;
  className?: string;
  leadingIconClassName?: string;
  labelClassName?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}) {
  void openGroup;

  return (
    <button
      type="button"
      className={cn(
        CHAT_PROCESS_META_ROW_CLASS,
        "m-0 w-full border-0 bg-transparent p-0 text-left shadow-none transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
        className,
      )}
      aria-expanded={open}
      onClick={onClick}
    >
      {Icon ? (
        <ChatProcessLeadingIcon
          className={cn("relative z-[1] rounded-sm", leadingIconClassName)}
        >
          <Icon className="h-[1.05em] w-[1.05em]" strokeWidth={2.25} />
        </ChatProcessLeadingIcon>
      ) : null}
      <span className={cn("min-w-0 shrink truncate", labelClassName)}>{label}</span>
      <span
        className={cn(
          "inline-flex h-[1.15em] w-[1.15em] shrink-0 items-center justify-center text-muted-foreground/80 transition-opacity",
          // Collapsed: hover/focus only. Expanded: always visible.
          open
            ? "opacity-100"
            : "opacity-0 group-hover/process-row:opacity-100 focus-visible:opacity-100",
        )}
      >
        <ChevronRight
          className={cn(
            "h-[1.05em] w-[1.05em] transition-transform",
            open && "rotate-90",
          )}
          strokeWidth={2.25}
        />
      </span>
    </button>
  );
}
