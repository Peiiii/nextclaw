import { AppWindow, Code2, FileText, Globe } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import type { ChatInlineDisplayViewModel } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import {
  getChatInlineDisplayDetail,
  getChatInlineDisplayLabel,
} from "./utils/chat-inline-display.utils";

type ChatInlineDisplayProps = {
  display: ChatInlineDisplayViewModel;
  renderInlineDisplay?: (
    display: ChatInlineDisplayViewModel,
  ) => ReactNode | undefined;
};

function ChatInlineDisplayIcon({ display }: { display: ChatInlineDisplayViewModel }) {
  const className = "h-3.5 w-3.5 shrink-0 text-muted-foreground";
  if (display.target.type === "file") {
    return <FileText className={className} aria-hidden />;
  }
  if (display.target.type === "url") {
    return <Globe className={className} aria-hidden />;
  }
  if (display.target.type === "panel_app") {
    return <AppWindow className={className} aria-hidden />;
  }
  return <Code2 className={className} aria-hidden />;
}

function formatJsonDetail(value: string): string {
  return value.length > 1_200 ? `${value.slice(0, 1_200)}\n...` : value;
}

function ChatInlineDisplayFallback({ display }: { display: ChatInlineDisplayViewModel }) {
  const label = getChatInlineDisplayLabel(display);
  const detail = getChatInlineDisplayDetail(display);
  const formattedDetail = display.target.type === "json"
    ? formatJsonDetail(detail)
    : detail;

  return (
    <section
      className={cn(
        "my-2 max-w-full border-l-2 border-border bg-muted/30 px-3 py-2",
        "text-xs leading-relaxed text-foreground",
      )}
      data-nextclaw-inline-display="true"
      data-nextclaw-inline-display-type={display.target.type}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ChatInlineDisplayIcon display={display} />
        <span className="min-w-0 truncate font-medium">{label}</span>
      </div>
      {display.description ? (
        <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
          {display.description}
        </p>
      ) : null}
      <pre
        className={cn(
          "mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words",
          "font-mono text-[11px] leading-relaxed text-muted-foreground",
        )}
      >
        {formattedDetail}
      </pre>
    </section>
  );
}

export function ChatInlineDisplay({
  display,
  renderInlineDisplay,
}: ChatInlineDisplayProps) {
  const rendered = renderInlineDisplay?.(display);
  if (rendered !== undefined && rendered !== null) {
    return <>{rendered}</>;
  }
  return <ChatInlineDisplayFallback display={display} />;
}
