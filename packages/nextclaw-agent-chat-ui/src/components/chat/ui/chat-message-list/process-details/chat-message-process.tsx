import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { ChatMessageTexts, ChatMessageToolPayloadState } from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import { ChatCollapsibleMetaSummary } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-collapsible-meta-summary";
import { ChatCollapsibleContent } from "@agent-chat-ui/components/chat/ui/chat-message-list/chat-collapsible-content";

export function ChatMessageProcess({ open, state, label, texts, onToggle, onRetry, children }: {
  open: boolean;
  state?: ChatMessageToolPayloadState;
  label?: string;
  texts: Pick<ChatMessageTexts, "toolPayloadLoadingLabel" | "toolPayloadLoadFailedLabel">;
  onToggle: () => void;
  onRetry: () => void;
  children: () => ReactNode;
}) {
  const loadingLabel = texts.toolPayloadLoadingLabel ?? "Loading details";
  const errorLabel = texts.toolPayloadLoadFailedLabel ?? "Couldn’t load details. Try again";

  return (
    <div className="group/process">
      <div className="mb-2 border-b border-border/60 pb-2">
        <ChatCollapsibleMetaSummary openGroup="process" open={open} label={label} onClick={onToggle} />
      </div>
      <ChatCollapsibleContent open={open}>{() => (
        state === "loading" || state === "summary" ? (
          <div role="status" aria-live="polite" className="mb-4 space-y-3 py-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" />
              <span>{loadingLabel}</span>
            </div>
            <div aria-hidden="true" className="space-y-2 border-l-2 border-border/60 pl-4 motion-safe:animate-pulse">
              <div className="h-3 w-2/5 rounded bg-muted" />
              <div className="h-3 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ) : state === "error" ? (
          <div role="alert" className="mb-4 py-2 text-sm text-muted-foreground">
            <button type="button" className="rounded text-left underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35" onClick={onRetry}>
              {errorLabel}
            </button>
          </div>
        ) : children()
      )}</ChatCollapsibleContent>
    </div>
  );
}
