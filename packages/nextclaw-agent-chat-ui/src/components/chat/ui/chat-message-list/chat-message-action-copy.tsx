import { useMemo } from 'react';
import { useCopyFeedback } from '@agent-chat-ui/components/chat/hooks/use-copy-feedback';
import { Check, Copy } from 'lucide-react';
import type { ChatMessageViewModel, ChatMessageTexts } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

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

  if (!messageText) return null;

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-accent flex items-center justify-center"
      aria-label={copied ? texts.copiedMessageLabel : texts.copyMessageLabel}
      title={copied ? texts.copiedMessageLabel : texts.copyMessageLabel}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
