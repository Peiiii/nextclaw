import { AppWindow, FileText, Folder, Puzzle } from "lucide-react";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import { ChatUiPrimitives } from "@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives";

function renderInlineTokenIcon(kind: string) {
  return kind === "panel_app" ? (
    <AppWindow aria-hidden="true" className="h-[0.9em] w-[0.9em]" />
  ) : kind === "workspace_file" ? (
    <FileText aria-hidden="true" className="h-[0.9em] w-[0.9em]" />
  ) : kind === "workspace_directory" ? (
    <Folder aria-hidden="true" className="h-[0.9em] w-[0.9em]" />
  ) : (
    <Puzzle aria-hidden="true" className="h-[0.9em] w-[0.9em]" />
  );
}

export function ChatInlineTokenBadge({
  kind,
  label,
  tooltip,
  onClick,
}: {
  kind: string;
  label: string;
  tooltip: string;
  onClick?: () => void;
}) {
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } = ChatUiPrimitives;
  const interactive = Boolean(onClick);
  const className = cn(
    "nextclaw-chat-inline-token mx-[0.08em] inline-flex max-w-full items-baseline gap-[0.22em] align-baseline text-[1em] font-normal leading-[inherit] text-[color:var(--md-link)] underline decoration-[1.2px] underline-offset-2",
    interactive
      ? "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--md-link)]/30"
      : "cursor-default decoration-dotted",
  );
  const content = (
    <>
      <span
        className="inline-flex h-[1em] w-[1em] shrink-0 translate-y-[0.08em] items-center justify-center text-current opacity-80"
      >
        {renderInlineTokenIcon(kind)}
      </span>
      <span className="truncate">{label}</span>
    </>
  );
  const trigger = interactive ? (
    <button
      type="button"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick?.();
      }}
    >
      {content}
    </button>
  ) : (
    <span className={className}>{content}</span>
  );

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[24rem] break-all text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
