import type { ReactNode } from 'react';
import type {
  ChatFileOpenActionViewModel,
  ChatInlineDisplayViewModel,
  ChatInlineTokenViewModel,
  ChatMessageTexts,
  ChatMessageViewModel,
  ChatPanelAppCardViewModel,
  ChatToolActionViewModel,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';
import { ChatMessageAvatar } from './chat-message-avatar';
import { ChatMessage } from './chat-message';
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
    hsl(var(--muted-foreground)) 0%,
    hsl(var(--muted-foreground)) 34%,
    hsl(var(--foreground-tertiary)) 43%,
    hsl(var(--foreground-muted)) 50%,
    hsl(var(--foreground-tertiary)) 57%,
    hsl(var(--muted-foreground)) 66%,
    hsl(var(--muted-foreground)) 100%
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
    color: hsl(var(--muted-foreground));
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

export type ChatMessageListProps = {
  messages: ChatMessageViewModel[];
  isSending: boolean;
  hasAssistantDraft: boolean;
  texts: ChatMessageTexts;
  className?: string;
  onToolAction?: (action: ChatToolActionViewModel) => void;
  onFileOpen?: (action: ChatFileOpenActionViewModel) => void;
  resolveFileContentUrl?: (action: ChatFileOpenActionViewModel) => string | null;
  onAttachmentOpen?: (
    file: Extract<ChatMessageViewModel["parts"][number], { type: "file" }>["file"],
  ) => void;
  onInlineTokenClick?: (token: ChatInlineTokenViewModel) => void;
  renderInlineDisplay?: (
    display: ChatInlineDisplayViewModel,
  ) => ReactNode | undefined;
  renderToolAgent?: (agentId: string) => ReactNode;
  renderPanelAppCard?: (panelApp: ChatPanelAppCardViewModel) => ReactNode;
};

function hasRenderableMessageContent(message: ChatMessageViewModel): boolean {
  return message.parts.some((part) => {
    if (part.type === 'markdown' || part.type === 'reasoning') {
      return hasRenderableText(part.text);
    }
    return true;
  });
}

function ChatMessageTypingFooter() {
  return (
    <div className="flex items-center gap-2 px-1 py-0.5 text-[11px] text-muted-foreground">
      <div className="flex space-x-1 items-center h-full">
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse"></div>
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:200ms]"></div>
        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:400ms]"></div>
      </div>
    </div>
  );
}

function ChatTypingIndicator({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
      <style>{TYPING_TEXT_SHEEN_CSS}</style>
      <span className="nextclaw-chat-typing-indicator__text">{label}</span>
    </div>
  );
}

export function ChatMessageList({
  className,
  isSending,
  messages,
  onAttachmentOpen,
  onFileOpen,
  onInlineTokenClick,
  onToolAction,
  renderInlineDisplay,
  renderPanelAppCard,
  renderToolAgent,
  resolveFileContentUrl,
  texts,
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
            <div className={cn('w-fit max-w-[92%] space-y-2 has-[[data-chat-message-wide-content=true]]:w-full', isUser && 'flex flex-col items-end')}>
              <ChatMessage
                message={message}
                texts={texts}
                onToolAction={onToolAction}
                onFileOpen={onFileOpen}
                onAttachmentOpen={onAttachmentOpen}
                onInlineTokenClick={onInlineTokenClick}
                resolveFileContentUrl={resolveFileContentUrl}
                renderInlineDisplay={renderInlineDisplay}
                renderToolAgent={renderToolAgent}
                renderPanelAppCard={renderPanelAppCard}
              />
              <div className={cn('flex items-center gap-2', isUser && 'justify-end')}>
                {isGenerating ? (
                  <ChatMessageTypingFooter />
                ) : (
                  <>
                    <div
                      className={cn(
                        'px-1 text-[11px] leading-4 text-muted-foreground',
                        isUser ? 'text-right' : 'text-left'
                      )}
                    >
                      {message.roleLabel} · {message.timestampLabel}
                    </div>
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
          <ChatTypingIndicator label={texts.typingLabel} />
        </div>
      ) : null}
    </div>
  );
}
