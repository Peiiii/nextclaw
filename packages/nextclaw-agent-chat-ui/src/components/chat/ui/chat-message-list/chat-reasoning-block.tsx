import { useRef } from "react";
import { useReasoningBlockOpenState } from "@agent-chat-ui/components/chat/hooks/use-reasoning-block-open-state";
import { useStickyBottomScroll } from "@agent-chat-ui/components/chat/hooks/use-sticky-bottom-scroll";
import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import { ChatCollapsibleMetaSummary } from "./chat-collapsible-meta-summary";

type ChatReasoningBlockProps = {
  label: string;
  text: string;
  characterCountTemplates?: {
    inProgress: string;
    completed: string;
  };
  isUser: boolean;
  isInProgress: boolean;
};

function formatReasoningLabel(
  label: string,
  text: string,
  characterCountTemplate?: string,
): string {
  const characterCount = Array.from(text).length;
  return (characterCountTemplate ?? `${label} · {count}`)
    .split("{count}")
    .join(String(characterCount));
}

export function ChatReasoningBlock({
  label,
  text,
  characterCountTemplates,
  isUser,
  isInProgress,
}: ChatReasoningBlockProps) {
  const { isOpen, onSummaryClick } = useReasoningBlockOpenState({
    isInProgress,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayLabel = formatReasoningLabel(
    label,
    text,
    isInProgress
      ? characterCountTemplates?.inProgress
      : characterCountTemplates?.completed,
  );
  const { onScroll } = useStickyBottomScroll({
    scrollRef,
    resetKey: `${displayLabel}:${isInProgress ? "streaming" : "idle"}`,
    isLoading: false,
    hasContent: text.length > 0,
    contentVersion: text,
    stickyThresholdPx: 20,
  });

  return (
    <div className="group/reasoning">
      <ChatCollapsibleMetaSummary
        openGroup="reasoning"
        open={isOpen}
        label={displayLabel}
        labelClassName={isUser ? "text-primary-100" : undefined}
        onClick={onSummaryClick}
      />
      {isOpen ? (
        <div
          ref={scrollRef}
          onScroll={onScroll}
          data-reasoning-scroll="true"
          className={cn(
            "mt-1 w-fit max-w-[500px] max-h-56 overflow-y-auto rounded-lg custom-scrollbar",
            isUser ? "bg-primary/70" : "bg-muted",
          )}
        >
          <pre className="min-w-0 whitespace-pre-wrap break-all p-2 text-[11px]">{text}</pre>
        </div>
      ) : null}
    </div>
  );
}
