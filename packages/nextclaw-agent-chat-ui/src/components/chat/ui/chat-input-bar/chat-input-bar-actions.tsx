import { ChatButton } from '../../default-skin/button';
import { ChatUiPrimitives } from '../primitives/chat-ui-primitives';
import type { ChatContextWindowIndicator, ChatInputBarActionsProps } from '../../view-models/chat-ui.types';
import { ArrowUp } from 'lucide-react';

const SEND_ERROR_PREVIEW_MAX_CHARS = 120;

function buildSendErrorPreview(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= SEND_ERROR_PREVIEW_MAX_CHARS) {
    return compact;
  }
  return `${compact.slice(0, SEND_ERROR_PREVIEW_MAX_CHARS - 1)}…`;
}

function StopIcon() {
  return (
    <span
      aria-hidden="true"
      data-testid="chat-stop-icon"
      className="block h-3 w-3 rounded-[2px] bg-gray-700 shadow-[inset_0_0_0_1px_rgba(17,24,39,0.06)]"
    />
  );
}

function ContextWindowIndicator({ contextWindow }: { contextWindow: ChatContextWindowIndicator }) {
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } = ChatUiPrimitives;
  const clampedRatio = Math.max(0, Math.min(1, contextWindow.ratio));
  const angle = Math.round(clampedRatio * 360);
  const ringColor = '#9ca3af';

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label={contextWindow.label}
            title={contextWindow.label}
          >
            <span
              aria-hidden="true"
              className="absolute inset-[7px] rounded-full"
              style={{ background: `conic-gradient(${ringColor} ${angle}deg, #e5e7eb 0deg)` }}
            />
            <span aria-hidden="true" className="absolute inset-[10px] rounded-full bg-white" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[18rem]">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-5 font-semibold text-gray-800">
              <span>{contextWindow.label}</span>
              <span>{contextWindow.percentLabel}</span>
            </div>
            {contextWindow.details.map((detail) => (
              <div key={detail.label} className="flex items-center justify-between gap-5 text-gray-600">
                <span>{detail.label}</span>
                <span className="font-medium text-gray-800">{detail.value}</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ChatInputBarActions({
  sendError,
  sendErrorDetailsLabel,
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
    Popover,
    PopoverContent,
    PopoverTrigger,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
  } = ChatUiPrimitives;
  const normalizedSendError = sendError?.trim() ?? '';
  const sendErrorPreview = normalizedSendError
    ? buildSendErrorPreview(normalizedSendError)
    : '';
  const resolvedSendErrorDetailsLabel = sendErrorDetailsLabel?.trim() || 'Details';

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      {normalizedSendError ? (
        <div className="flex max-w-[420px] items-start justify-end gap-2 text-right">
          <div className="min-w-0 flex-1 text-[11px] text-red-600">
            <span
              className="block truncate"
              title={normalizedSendError}
            >
              {sendErrorPreview}
            </span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="shrink-0 rounded-full border border-red-200/80 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                {resolvedSendErrorDetailsLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(32rem,calc(100vw-1.5rem))] border-red-100/80 p-0"
            >
              <div className="border-b border-red-100 bg-red-50/80 px-4 py-2 text-xs font-semibold text-red-700">
                {resolvedSendErrorDetailsLabel}
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-4 py-3 text-xs leading-relaxed text-red-700">
                {normalizedSendError}
              </pre>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        {contextWindow ? <ContextWindowIndicator contextWindow={contextWindow} /> : null}
        {isSending ? (
          canStopGeneration ? (
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
          )
        ) : (
          <ChatButton
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label={sendButtonLabel}
            onClick={() => void onSend()}
            disabled={sendDisabled}
          >
            <ArrowUp className="h-5 w-5" />
          </ChatButton>
        )}
      </div>
    </div>
  );
}
