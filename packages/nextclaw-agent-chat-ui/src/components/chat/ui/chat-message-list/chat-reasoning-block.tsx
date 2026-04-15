import { useRef } from "react";
import { useReasoningBlockOpenState } from "../../hooks/use-reasoning-block-open-state";
import { useStickyBottomScroll } from "../../hooks/use-sticky-bottom-scroll";
import { cn } from "../../internal/cn";

type ChatReasoningBlockProps = {
  label: string;
  text: string;
  isUser: boolean;
  isInProgress: boolean;
};

function normalizeReasoningLabel(label: string): string {
  const normalizedLabel = label.trim().toLowerCase();
  if (
    normalizedLabel === "reasoning" ||
    normalizedLabel === "thinking" ||
    normalizedLabel === "推理" ||
    normalizedLabel === "推理过程" ||
    normalizedLabel === "思考过程" ||
    normalizedLabel === "思考"
  ) {
    return "思考";
  }
  return label;
}

export function ChatReasoningBlock({ label, text, isUser, isInProgress }: ChatReasoningBlockProps) {
  const { isOpen, onSummaryClick } = useReasoningBlockOpenState({
    isInProgress,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayLabel = normalizeReasoningLabel(label);
  const { onScroll } = useStickyBottomScroll({
    scrollRef,
    resetKey: `${displayLabel}:${isInProgress ? "streaming" : "idle"}`,
    isLoading: false,
    hasContent: text.length > 0,
    contentVersion: text,
    stickyThresholdPx: 20,
  });

  return (
    <details className="mt-2" open={isOpen}>
      <summary
        className={cn("cursor-pointer text-xs", isUser ? "text-primary-100" : "text-gray-500")}
        onClick={onSummaryClick}
      >
        {displayLabel}
      </summary>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        data-reasoning-scroll="true"
        className={cn(
          "mt-2 w-fit max-w-[500px] max-h-56 overflow-y-auto rounded-lg custom-scrollbar-amber",
          isUser ? "bg-primary-700/60" : "bg-gray-100",
        )}
      >
        <pre className="min-w-0 whitespace-pre-wrap break-all p-2 text-[11px]">{text}</pre>
      </div>
    </details>
  );
}
