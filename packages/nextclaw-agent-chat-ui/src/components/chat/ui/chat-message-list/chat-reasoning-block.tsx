import { cn } from "../../internal/cn";
import { useReasoningBlockOpenState } from "../../hooks/use-reasoning-block-open-state";

type ChatReasoningBlockProps = {
  label: string;
  text: string;
  isUser: boolean;
  isInProgress: boolean;
};

export function ChatReasoningBlock({ label, text, isUser, isInProgress }: ChatReasoningBlockProps) {
  const { isOpen, onSummaryClick } = useReasoningBlockOpenState({
    isInProgress,
  });

  return (
    <details className="mt-2" open={isOpen}>
      <summary
        className={cn("cursor-pointer text-xs", isUser ? "text-primary-100" : "text-gray-500")}
        onClick={onSummaryClick}
      >
        {label}
      </summary>
      <pre
        className={cn(
          "mt-2 w-fit max-w-[500px] whitespace-pre-wrap break-all rounded-lg p-2 text-[11px]",
          isUser ? "bg-primary-700/60" : "bg-gray-100"
        )}
      >
        {text}
      </pre>
    </details>
  );
}
