import type { ChatMessageListProps } from '../../view-models/chat-ui.types';
import { cn } from '../../internal/cn';
import { ChatMessageAvatar } from './chat-message-avatar';
import { ChatMessage } from './chat-message';
import { ChatMessageMeta } from './chat-message-meta';
import { ChatMessageActionCopy } from './chat-message-action-copy';

const INVISIBLE_ONLY_TEXT_PATTERN = /\u200B|\u200C|\u200D|\u2060|\uFEFF/g;

function hasRenderableText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return trimmed.replace(INVISIBLE_ONLY_TEXT_PATTERN, '').trim().length > 0;
}

function hasRenderableMessageContent(message: ChatMessageListProps['messages'][number]): boolean {
  return message.parts.some((part) => {
    if (part.type === 'markdown' || part.type === 'reasoning') {
      return hasRenderableText(part.text);
    }
    return true;
  });
}

function ChatMessageTypingFooter() {
  return (
    <div className="flex items-center gap-2 px-1 py-0.5 text-[11px] text-gray-400">
      <div className="flex space-x-1 items-center h-full">
        <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse"></div>
        <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse [animation-delay:200ms]"></div>
        <div className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse [animation-delay:400ms]"></div>
      </div>
    </div>
  );
}

export function ChatMessageList(props: ChatMessageListProps) {
  const visibleMessages = props.messages.filter(hasRenderableMessageContent);
  const hasRenderableAssistantDraft = visibleMessages.some(
    (message) =>
      message.role === 'assistant' &&
      (message.status === 'streaming' || message.status === 'pending')
  );

  return (
    <div className={cn('space-y-5', props.className)}>
      {visibleMessages.map((message) => {
        const isUser = message.role === 'user';
        const isGenerating = !isUser && (message.status === 'streaming' || message.status === 'pending');

        return (
          <div key={message.id} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
            {!isUser ? <ChatMessageAvatar role={message.role} /> : null}
            <div className={cn('w-fit max-w-[92%] space-y-2', isUser && 'flex flex-col items-end')}>
              <ChatMessage
                message={message}
                texts={props.texts}
                onToolAction={props.onToolAction}
              />
              <div className={cn('flex items-center gap-2', isUser && 'justify-end')}>
                {isGenerating ? (
                  <ChatMessageTypingFooter />
                ) : (
                  <>
                    <ChatMessageMeta roleLabel={message.roleLabel} timestampLabel={message.timestampLabel} isUser={isUser} />
                    {!isUser ? <ChatMessageActionCopy message={message} texts={props.texts} /> : null}
                  </>
                )}
              </div>
            </div>
            {isUser ? <ChatMessageAvatar role={message.role} /> : null}
          </div>
        );
      })}

      {props.isSending && !hasRenderableAssistantDraft ? (
        <div className="flex justify-start gap-3">
          <ChatMessageAvatar role="assistant" />
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
            {props.texts.typingLabel}
          </div>
        </div>
      ) : null}
    </div>
  );
}
