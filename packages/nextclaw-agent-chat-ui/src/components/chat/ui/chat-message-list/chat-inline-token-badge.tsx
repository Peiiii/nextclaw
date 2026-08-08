import { cn } from "@agent-chat-ui/components/chat/internal/cn";
import {
  CHAT_REFERENCE_TAG_CLASS_NAME,
  ChatReferenceTagContent,
  ChatReferenceTagPreview,
} from "@agent-chat-ui/components/chat/ui/chat-reference-tag";
import { ChatUiPrimitives } from "@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives";

export function ChatInlineTokenBadge({
  characterCountLabel,
  excerpt,
  kind,
  label,
  location,
  path,
  tooltip,
  onClick,
}: {
  characterCountLabel?: string;
  excerpt?: string;
  kind: string;
  label: string;
  location?: string;
  path?: string;
  tooltip: string;
  onClick?: () => void;
}) {
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } = ChatUiPrimitives;
  const interactive = Boolean(onClick);
  const className = cn(
    CHAT_REFERENCE_TAG_CLASS_NAME,
    "nextclaw-chat-inline-token mx-[0.08em]",
    interactive
      ? "cursor-pointer transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
      : "cursor-default",
  );
  const source = path || tooltip;
  const content = (
    <ChatReferenceTagContent
      excerpt={excerpt}
      kind={kind}
      label={label}
      metricLabel={location ?? characterCountLabel}
      source={source}
    />
  );
  const token = interactive ? (
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

  if (kind === "workspace_excerpt" && excerpt) {
    return (
      <ChatReferenceTagPreview
        characterCountLabel={characterCountLabel}
        excerpt={excerpt}
        label={label}
        location={location}
        path={source}
      >
        {token}
      </ChatReferenceTagPreview>
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{token}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[24rem] break-all text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
