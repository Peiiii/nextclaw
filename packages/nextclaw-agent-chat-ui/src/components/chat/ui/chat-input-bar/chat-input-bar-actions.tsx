import { ChatButton } from '@agent-chat-ui/components/chat/default-skin/button';
import { ChatUiPrimitives } from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';
import type { ChatContextWindowIndicator, ChatInputBarActionsProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { ArrowUp } from 'lucide-react';

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
            className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
              <div key={detail.label} className="flex items-center justify-between gap-5 text-muted-foreground">
                <span>{detail.label}</span>
                <span className="font-medium text-foreground">{detail.value}</span>
              </div>
            ))}
          </div>
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
  stopButtonLabel,
  contextWindow,
  onSend,
  onStop
}: ChatInputBarActionsProps) {
  const {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
  } = ChatUiPrimitives;
  const showSendButton = !isSending || !sendDisabled;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {contextWindow ? <ContextWindowIndicator contextWindow={contextWindow} /> : null}
      {showSendButton ? (
        <ChatButton
          size="icon"
          className="h-8 w-8 rounded-full"
          aria-label={sendButtonLabel}
          onClick={() => void onSend()}
          disabled={sendDisabled}
        >
          <ArrowUp className="h-5 w-5" />
        </ChatButton>
      ) : canStopGeneration ? (
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
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <ChatButton
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full"
                  aria-label={stopButtonLabel}
                  disabled
                >
                  <StopIcon />
                </ChatButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">{stopHint}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
