import { ChatButton } from '@agent-chat-ui/components/chat/default-skin/button';
import { ChatUiPrimitives } from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import type { ChatContextWindowIndicator, ChatInputBarActionsProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { ArrowUp, Play } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

function StopIcon() {
  return (
    <span
      aria-hidden="true"
      data-testid="chat-stop-icon"
      className="block h-3 w-3 rounded-[2px] bg-foreground shadow-[inset_0_0_0_1px_hsl(var(--border))]"
    />
  );
}

function ContextWindowIndicator({ contextWindow }: { contextWindow: ChatContextWindowIndicator }) {
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } = ChatUiPrimitives;
  const clampedRatio = Math.max(0, Math.min(1, contextWindow.ratio));
  const angle = Math.round(clampedRatio * 360);
  const ringColor = 'hsl(var(--muted-foreground))';

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[var(--interaction-hover)] hover:text-accent-foreground"
            aria-label={contextWindow.label}
            title={contextWindow.label}
          >
            <span
              aria-hidden="true"
              className="absolute inset-[7px] rounded-full"
              style={{ background: `conic-gradient(${ringColor} ${angle}deg, hsl(var(--border)) 0deg)` }}
            />
            <span aria-hidden="true" className="absolute inset-[10px] rounded-full bg-card" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[18rem]">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-5 font-semibold text-foreground">
              <span>{contextWindow.label}</span>
              <span>{contextWindow.percentLabel}</span>
            </div>
            {contextWindow.details.map((detail) => (
              <Fragment key={detail.label}>
                {detail.dividerBefore ? (
                  <div
                    aria-hidden="true"
                    className="my-2 border-t border-border/70"
                    data-testid="context-window-detail-divider"
                  />
                ) : null}
                <div className="flex items-center justify-between gap-5 text-muted-foreground">
                  <span>{detail.label}</span>
                  <span className="font-medium text-foreground">{detail.value}</span>
                </div>
              </Fragment>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ActionTooltip({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } =
    ChatUiPrimitives;
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ChatInputBarActions({
  isSending,
  canStopGeneration,
  sendDisabled,
  stopDisabled,
  stopHint,
  sendButtonLabel,
  sendIcon = "send",
  stopButtonLabel,
  contextWindow,
  onSend,
  onStop
}: ChatInputBarActionsProps) {
  const showSendButton = !isSending || !sendDisabled;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {contextWindow ? <ContextWindowIndicator contextWindow={contextWindow} /> : null}
      {showSendButton ? (
        <ActionTooltip label={sendButtonLabel}>
          <ChatButton
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label={sendButtonLabel}
            onClick={() => void onSend()}
            disabled={sendDisabled}
          >
            {sendIcon === "continue" ? (
              <Play data-testid="chat-continue-input-icon" className="h-4 w-4" />
            ) : (
              <ArrowUp className="h-5 w-5" />
            )}
          </ChatButton>
        </ActionTooltip>
      ) : canStopGeneration ? (
        <ActionTooltip label={stopButtonLabel}>
          <ChatButton
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-full"
            aria-label={stopButtonLabel}
            onClick={() => void onStop()}
            disabled={stopDisabled}
          >
            <StopIcon />
          </ChatButton>
        </ActionTooltip>
      ) : (
        <ActionTooltip label={stopHint}>
          <ChatButton
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-full"
            aria-label={stopButtonLabel}
            disabled
          >
            <StopIcon />
          </ChatButton>
        </ActionTooltip>
      )}
    </div>
  );
}
