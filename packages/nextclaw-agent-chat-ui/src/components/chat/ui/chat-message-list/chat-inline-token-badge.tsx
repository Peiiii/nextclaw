import { AppWindow, Puzzle } from "lucide-react";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";

type ChatInlineTokenTone = "skill" | "panel_app" | "default";

function resolveInlineTokenTone(kind: string): ChatInlineTokenTone {
  if (kind === "skill") {
    return "skill";
  }
  if (kind === "panel_app") {
    return "panel_app";
  }
  return "default";
}

function resolveInlineTokenBadgeClassName(
  tone: ChatInlineTokenTone,
  isUser: boolean,
  interactive: boolean,
): string {
  if (tone === "skill") {
    // Skill tokens use the markdown link semantic color, not primary brand fill.
    return cn(
      "border-transparent bg-transparent text-[color:var(--md-link)]",
      interactive &&
        "cursor-pointer underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--md-link)]/30",
      !interactive && "cursor-default",
    );
  }
  if (tone === "panel_app") {
    return isUser
      ? "border-primary-foreground/40 bg-primary-foreground/22 text-primary-foreground"
      : "border-border bg-muted text-foreground";
  }
  return isUser
    ? "border-primary-foreground/40 bg-primary-foreground/22 text-primary-foreground"
    : "border-border bg-muted text-muted-foreground";
}

function resolveInlineTokenIconClassName(
  tone: ChatInlineTokenTone,
  isUser: boolean,
): string {
  if (tone === "skill") {
    return "text-current opacity-80";
  }
  if (tone === "panel_app") {
    return isUser ? "text-primary-foreground/80" : "text-muted-foreground";
  }
  return isUser ? "text-primary-foreground/80" : "text-muted-foreground";
}

function renderInlineTokenIcon(tone: ChatInlineTokenTone) {
  return tone === "panel_app" ? (
    <AppWindow aria-hidden="true" className="h-3 w-3" />
  ) : (
    <Puzzle aria-hidden="true" className="h-3 w-3" />
  );
}

export function ChatInlineTokenBadge({
  kind,
  label,
  isUser,
  onClick,
}: {
  kind: string;
  label: string;
  isUser: boolean;
  onClick?: () => void;
}) {
  const tone = resolveInlineTokenTone(kind);
  const interactive = Boolean(onClick);
  const className = cn(
    "nextclaw-chat-inline-token mx-[2px] inline-flex max-w-full items-center gap-1 align-baseline text-[11px] font-medium",
    tone === "skill" ? "h-auto rounded-none px-0 py-0" : "h-7 rounded-xl border px-2.5",
    resolveInlineTokenBadgeClassName(tone, isUser, interactive),
  );
  const content = (
    <>
      <span
        className={cn(
          "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center",
          resolveInlineTokenIconClassName(tone, isUser),
        )}
      >
        {renderInlineTokenIcon(tone)}
      </span>
      <span className="truncate">{label}</span>
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={className}
        title={label}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClick?.();
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={className} title={label}>
      {content}
    </span>
  );
}
