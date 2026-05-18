import type { ChatMessageListProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';
import { ChatMessageAvatar } from './chat-message-avatar';
import { ChatMessage } from './chat-message';
import { ChatMessageMeta } from './chat-message-meta';
import { ChatMessageActionCopy } from './chat-message-action-copy';

const INVISIBLE_ONLY_TEXT_PATTERN = /\u200B|\u200C|\u200D|\u2060|\uFEFF/g;
const TYPING_TEXT_SHEEN_CSS = `
@keyframes nextclaw-chat-typing-text-sheen {
  0% {
    background-position: 160% 0;
  }
  100% {
    background-position: -60% 0;
  }
}

.nextclaw-chat-typing-indicator__text {
  background-image: linear-gradient(
    100deg,
    #6b7280 0%,
    #6b7280 34%,
    #a6adba 43%,
    #f8fafc 50%,
    #a6adba 57%,
    #6b7280 66%,
    #6b7280 100%
  );
  background-size: 240% 100%;
  background-position: 160% 0;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  animation: nextclaw-chat-typing-text-sheen 2.5s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .nextclaw-chat-typing-indicator__text {
    animation: none;
    background-image: none;
    color: #6b7280;
    -webkit-text-fill-color: currentColor;
  }
}
`;

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

function ChatTypingIndicator({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm">
      <style>{TYPING_TEXT_SHEEN_CSS}</style>
      <span className="nextclaw-chat-typing-indicator__text">{label}</span>
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
                onFileOpen={props.onFileOpen}
                renderToolAgent={props.renderToolAgent}
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
          <ChatTypingIndicator label={props.texts.typingLabel} />
        </div>
      ) : null}
    </div>
  );
}
