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
      ? "border-emerald-200/35 bg-emerald-400/18 text-emerald-50/95"
      : "border-emerald-200/70 bg-emerald-50 text-emerald-700";
  }
  if (tone === "panel_app") {
    return isUser
      ? "border-sky-200/35 bg-sky-400/18 text-sky-50/95"
      : "border-sky-200/70 bg-sky-50 text-sky-700";
  }
  return isUser
    ? "border-white/30 bg-white/18 text-white"
    : "border-slate-200/80 bg-slate-100 text-slate-700";
}

function resolveInlineTokenIconClassName(
  tone: ChatInlineTokenTone,
  isUser: boolean,
): string {
  if (tone === "skill") {
    return isUser ? "text-emerald-100/90" : "text-emerald-600";
  }
  if (tone === "panel_app") {
    return isUser ? "text-sky-100/90" : "text-sky-600";
  }
  return isUser ? "text-white/70" : "text-slate-500";
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
