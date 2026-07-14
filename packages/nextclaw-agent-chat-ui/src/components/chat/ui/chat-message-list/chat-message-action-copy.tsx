import { useMemo } from 'react';
import { useCopyFeedback } from '@agent-chat-ui/components/chat/hooks/use-copy-feedback';
import { Check, Copy } from 'lucide-react';
import type { ChatMessageViewModel, ChatMessageTexts } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { ChatUiPrimitives } from '@agent-chat-ui/components/chat/ui/primitives/chat-ui-primitives';

export function ChatMessageActionCopy({
  message,
  texts,
}: {
  message: ChatMessageViewModel;
  texts: Pick<ChatMessageTexts, 'copyMessageLabel' | 'copiedMessageLabel'>;
}) {
  const messageText = useMemo(() => {
    return message.parts
      .map((part) => {
        if (part.type === 'markdown') return part.text;
        if (part.type === 'unknown') return part.text;
        return '';
      })
      .filter((text) => !!text && text.trim().length > 0)
      .join('\n\n');
  }, [message.parts]);

  const { copied, copy } = useCopyFeedback({ text: messageText });
  const label = copied ? texts.copiedMessageLabel : texts.copyMessageLabel;
  const { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } = ChatUiPrimitives;

  if (!messageText) return null;

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            aria-label={label}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
