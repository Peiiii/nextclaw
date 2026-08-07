import { useMemo, useRef, useState, type RefObject } from "react";
import { Check, CirclePlay, Copy, MoreHorizontal, Pencil } from "lucide-react";
import { useCopyFeedback } from "@agent-chat-ui/components/chat/hooks/use-copy-feedback";
import type {
  ChatMessageDetailActionViewModel,
  ChatMessageActionViewModel,
  ChatMessageTexts,
  ChatMessageViewModel,
} from "@agent-chat-ui/components/chat/view-models/chat-ui.types";
import { ChatUiPrimitives } from "@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives";

function ChatMessageActionCopy({
  messageText,
  texts,
}: {
  messageText: string;
  texts: Pick<ChatMessageTexts, "copyMessageLabel" | "copiedMessageLabel">;
}) {
  const { copied, copy } = useCopyFeedback({ text: messageText });
  const label = copied ? texts.copiedMessageLabel : texts.copyMessageLabel;
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } =
    ChatUiPrimitives;

  if (!messageText) return null;

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            aria-label={label}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ChatMessageAction({
  action,
  onAction,
}: {
  action: ChatMessageActionViewModel;
  onAction: (action: ChatMessageActionViewModel) => void;
}) {
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } =
    ChatUiPrimitives;

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={action.label}
            className="flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            disabled={action.disabled}
            onClick={() => onAction(action)}
          >
            {action.icon === "edit" ? (
              <Pencil className="h-3.5 w-3.5" />
            ) : (
              <CirclePlay data-testid="chat-continue-message-icon" className="h-3.5 w-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {action.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ChatMessageDetailDialog({
  action,
  open,
  onOpenChange,
  restoreFocusRef,
}: {
  action: ChatMessageDetailActionViewModel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
  } = ChatUiPrimitives;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-xl"
        closeLabel={action.dialog.closeLabel}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocusRef.current?.focus();
        }}
      >
        <DialogHeader className="space-y-1 pr-8 text-left">
          <DialogTitle className="text-lg font-semibold leading-tight text-foreground">
            {action.dialog.title}
          </DialogTitle>
          {action.dialog.description ? (
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {action.dialog.description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <dl className="divide-y divide-border/70 rounded-xl border border-border/80 bg-muted/20 px-4">
          {action.dialog.rows.map((row) => (
            <div
              key={row.label}
              className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4"
            >
              <dt className="text-xs font-medium text-muted-foreground">
                {row.label}
              </dt>
              <dd className="min-w-0 break-all font-mono text-xs leading-5 text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}

function ChatMessageActionMore({ message }: { message: ChatMessageViewModel }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAction, setSelectedAction] =
    useState<ChatMessageDetailActionViewModel | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { moreActions } = message;
  const {
    Popover,
    PopoverContent,
    PopoverTrigger,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } = ChatUiPrimitives;

  if (!moreActions?.items.length) return null;

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <TooltipProvider delayDuration={250}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  ref={triggerRef}
                  type="button"
                  aria-label={moreActions.triggerLabel}
                  className="flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {moreActions.triggerLabel}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent align="end" className="w-52 p-1" role="menu">
          {moreActions.items.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-[var(--interaction-hover)] focus-visible:bg-accent focus-visible:outline-none"
              onClick={() => {
                setMenuOpen(false);
                setSelectedAction(action);
                setDetailOpen(true);
              }}
            >
              {action.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
      {selectedAction ? (
        <ChatMessageDetailDialog
          action={selectedAction}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          restoreFocusRef={triggerRef}
        />
      ) : null}
    </>
  );
}

export function ChatMessageActions({
  message,
  onAction,
  texts,
}: {
  message: ChatMessageViewModel;
  onAction?: (action: ChatMessageActionViewModel) => void;
  texts: Pick<ChatMessageTexts, "copyMessageLabel" | "copiedMessageLabel">;
}) {
  const messageText = useMemo(
    () =>
      message.parts
        .map((part) => {
          if (part.type === "markdown") return part.text;
          if (part.type === "unknown") return part.text;
          return "";
        })
        .filter((text) => Boolean(text?.trim()))
        .join("\n\n"),
    [message.parts],
  );

  return (
    <div className="flex items-center gap-0.5">
      {onAction
        ? message.actions?.map((action) => (
          <ChatMessageAction key={action.key} action={action} onAction={onAction} />
        ))
        : null}
      <ChatMessageActionCopy messageText={messageText} texts={texts} />
      <ChatMessageActionMore message={message} />
    </div>
  );
}
