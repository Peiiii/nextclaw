import { ChatButton } from '../../default-skin/button';
import { ChatUiPrimitives } from '../primitives/chat-ui-primitives';
import type { ChatInputBarActionsProps } from '../../view-models/chat-ui.types';
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
    <div className="flex flex-col items-end gap-1">
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
