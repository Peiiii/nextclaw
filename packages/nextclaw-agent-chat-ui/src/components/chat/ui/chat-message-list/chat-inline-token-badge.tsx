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
): string {
  if (tone === "skill") {
    return isUser
      ? "border-primary-foreground/30 bg-primary-foreground/18 text-primary-foreground"
      : "border-border bg-accent text-accent-foreground";
  }
  if (tone === "panel_app") {
    return isUser
      ? "border-primary-foreground/30 bg-primary-foreground/18 text-primary-foreground"
      : "border-border bg-accent text-accent-foreground";
  }
  return isUser
    ? "border-primary-foreground/30 bg-primary-foreground/18 text-primary-foreground"
    : "border-border bg-muted text-muted-foreground";
}

function resolveInlineTokenIconClassName(
  tone: ChatInlineTokenTone,
  isUser: boolean,
): string {
  if (tone === "skill") {
    return isUser ? "text-primary-foreground/70" : "text-muted-foreground";
  }
  if (tone === "panel_app") {
    return isUser ? "text-primary-foreground/70" : "text-muted-foreground";
  }
  return isUser ? "text-primary-foreground/70" : "text-muted-foreground";
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
}: {
  kind: string;
  label: string;
  isUser: boolean;
}) {
  const tone = resolveInlineTokenTone(kind);
  return (
    <span
      className={cn(
        "mx-[2px] inline-flex h-7 max-w-full items-center gap-1.5 rounded-xl border px-2.5 align-baseline text-[11px] font-medium shadow-[0_0_0_1px_rgba(15,23,42,0.03)]",
        resolveInlineTokenBadgeClassName(tone, isUser),
      )}
      title={label}
    >
      <span
        className={cn(
          "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center",
          resolveInlineTokenIconClassName(tone, isUser),
        )}
      >
        {renderInlineTokenIcon(tone)}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}
