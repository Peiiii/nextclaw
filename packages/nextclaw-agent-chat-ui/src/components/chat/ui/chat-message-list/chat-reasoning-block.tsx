import { useEffect, useRef, useState, type MouseEvent } from "react";
import { cn } from "../../internal/cn";

type ChatReasoningBlockProps = {
  label: string;
  text: string;
  isUser: boolean;
  isInProgress: boolean;
};

export function ChatReasoningBlock({ label, text, isUser, isInProgress }: ChatReasoningBlockProps) {
  const [isOpen, setIsOpen] = useState(isInProgress);
  const [keepOpenAfterCompletion, setKeepOpenAfterCompletion] = useState(false);
  const previousInProgressRef = useRef(isInProgress);

  useEffect(() => {
    const wasInProgress = previousInProgressRef.current;
    if (!wasInProgress && isInProgress) {
      setIsOpen(true);
      setKeepOpenAfterCompletion(false);
    } else if (wasInProgress && !isInProgress && !keepOpenAfterCompletion) {
      setIsOpen(false);
    }
    previousInProgressRef.current = isInProgress;
  }, [isInProgress, keepOpenAfterCompletion]);

  function handleSummaryClick(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (!nextOpen) {
      setKeepOpenAfterCompletion(false);
      return;
    }

    if (isInProgress) {
      setKeepOpenAfterCompletion(true);
    }
  }

  return (
    <details className="mt-3" open={isOpen}>
      <summary
        className={cn("cursor-pointer text-xs", isUser ? "text-primary-100" : "text-gray-500")}
        onClick={handleSummaryClick}
      >
        {label}
      </summary>
      <pre
        className={cn(
          "mt-2 whitespace-pre-wrap break-words rounded-lg p-2 text-[11px]",
          isUser ? "bg-primary-700/60" : "bg-gray-100"
        )}
      >
        {text}
      </pre>
    </details>
  );
}
