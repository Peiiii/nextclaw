import type { ChatMessageListProps } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';
import { ChatMessageAvatar } from './chat-message-avatar';
import { ChatMessage } from './chat-message';
import { ChatMessageMeta } from './chat-message-meta';
import { ChatMessageActionCopy } from './chat-message-action-copy';

const INVISIBLE_ONLY_TEXT_PATTERN = /\u200B|\u200C|\u200D|\u2060|\uFEFF/g;
const TYPING_SHINE_CLASS = 'nextclaw-agent-typing-shine';
const TYPING_SHINE_STYLE = `
@keyframes nextclaw-agent-typing-shine {
  0%, 18% {
    opacity: 0;
    transform: translateX(0) skewX(-18deg);
  }
  30% {
    opacity: 0.55;
  }
  58% {
    opacity: 0.36;
  }
  76%, 100% {
    opacity: 0;
    transform: translateX(360%) skewX(-18deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .${TYPING_SHINE_CLASS} {
    animation: none !important;
    opacity: 0 !important;
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

function ChatMessageTypingPlaceholder({ label }: { label: string }) {
  return (
    <>
      <style>{TYPING_SHINE_STYLE}</style>
      <div
        className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-sm"
        role="status"
      >
        <span className="relative z-10">{label}</span>
        <span
          aria-hidden="true"
          className={cn(
            TYPING_SHINE_CLASS,
            'pointer-events-none absolute -inset-y-4 -left-[42%] w-[42%] bg-[linear-gradient(105deg,transparent_0%,rgba(148,163,184,0.2)_36%,rgba(255,255,255,0.82)_50%,rgba(148,163,184,0.18)_64%,transparent_100%)]'
          )}
          style={{ animation: 'nextclaw-agent-typing-shine 2.35s cubic-bezier(0.4, 0, 0.2, 1) infinite' }}
        />
      </div>
    </>
  );
}

export function ChatMessageList({
  messages,
  className,
  texts,
  onToolAction,
  onFileOpen,
  renderToolAgent,
  isSending
}: ChatMessageListProps) {
  const visibleMessages = messages.filter(hasRenderableMessageContent);
  const hasRenderableAssistantDraft = visibleMessages.some(
    (message) =>
      message.role === 'assistant' &&
      (message.status === 'streaming' || message.status === 'pending')
  );

  return (
    <div className={cn('space-y-5', className)}>
      {visibleMessages.map((message) => {
        const isUser = message.role === 'user';
        const isGenerating = !isUser && (message.status === 'streaming' || message.status === 'pending');

        return (
          <div key={message.id} className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
            {!isUser ? <ChatMessageAvatar role={message.role} /> : null}
            <div className={cn('w-fit max-w-[92%] space-y-2', isUser && 'flex flex-col items-end')}>
              <ChatMessage
                message={message}
                texts={texts}
                onToolAction={onToolAction}
                onFileOpen={onFileOpen}
                renderToolAgent={renderToolAgent}
              />
              <div className={cn('flex items-center gap-2', isUser && 'justify-end')}>
                {isGenerating ? (
                  <ChatMessageTypingFooter />
                ) : (
                  <>
                    <ChatMessageMeta roleLabel={message.roleLabel} timestampLabel={message.timestampLabel} isUser={isUser} />
                    {!isUser ? <ChatMessageActionCopy message={message} texts={texts} /> : null}
                  </>
                )}
              </div>
            </div>
            {isUser ? <ChatMessageAvatar role={message.role} /> : null}
          </div>
        );
      })}

      {isSending && !hasRenderableAssistantDraft ? (
        <div className="flex justify-start gap-3">
          <ChatMessageAvatar role="assistant" />
          <ChatMessageTypingPlaceholder label={texts.typingLabel} />
        </div>
      ) : null}
    </div>
  );
}
