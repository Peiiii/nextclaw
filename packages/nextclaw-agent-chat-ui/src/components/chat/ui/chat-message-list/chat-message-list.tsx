import type { ReactNode } from 'react';
import type {
  ChatFileOpenActionViewModel,
  ChatInlineDisplayViewModel,
  ChatInlineTokenViewModel,
  ChatMessageLayout,
  ChatMessageTexts,
  ChatMessageViewModel,
  ChatPanelAppCardViewModel,
  ChatToolActionViewModel,
} from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';
import { ChatMessageAvatar } from './chat-message-avatar';
import { ChatMessage } from './chat-message';
import { ChatMessageActions } from './chat-message-actions';

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
  assistantAvatarIcon?: ReactNode;
  layout?: ChatMessageLayout;
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

function ChatTypingIndicator({
  label,
  layout,
}: {
  label: string;
  layout: ChatMessageLayout;
}) {
  return (
    <div
      data-chat-message-surface={layout === "flat" ? "flat" : "card"}
      className={cn(
        "text-sm text-muted-foreground",
        layout === "flat"
          ? "py-1"
          : "rounded-2xl border border-border bg-card px-4 py-3 shadow-sm",
      )}
    >
      <style>{TYPING_TEXT_SHEEN_CSS}</style>
      <span className="nextclaw-chat-typing-indicator__text">{label}</span>
    </div>
  );
}

export function ChatMessageList({
  assistantAvatarIcon,
  className,
  isSending,
  layout = "card",
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
        const content = (
          <ChatMessage
            layout={layout}
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
        );

        if (layout === "flat" && !isUser) {
          return (
            <article key={message.id} data-chat-message-layout="flat" className="w-full min-w-0 space-y-2">
              <div data-chat-message-header="flat" className="flex min-w-0 items-center gap-2.5">
                <ChatMessageAvatar
                  assistantIcon={assistantAvatarIcon}
                  role={message.role}
                  size="compact"
                />
                <span className="truncate text-sm font-semibold text-foreground">
                  {message.roleLabel}
                </span>
              </div>
              <div data-chat-message-body="flat" className="min-w-0 w-full">
                {content}
              </div>
              {isGenerating ? (
                <div className="w-full">
                  <ChatMessageTypingFooter />
                </div>
              ) : (
                <div data-chat-message-footer="flat" className="flex flex-wrap items-center gap-2">
                  <span className="px-1 text-[11px] leading-4 text-muted-foreground">
                    {message.timestampLabel}
                    {message.executionSummaryLabel ? ` · ${message.executionSummaryLabel}` : null}
                  </span>
                  <ChatMessageActions message={message} texts={texts} />
                </div>
              )}
            </article>
          );
        }

        return (
          <div
            key={message.id}
            data-chat-message-layout="card"
            className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
          >
            {!isUser ? (
              <ChatMessageAvatar
                assistantIcon={assistantAvatarIcon}
                role={message.role}
              />
            ) : null}
            <div className={cn('w-fit max-w-[92%] space-y-2 has-[[data-chat-message-wide-content=true]]:w-full', isUser && 'flex flex-col items-end')}>
              {content}
              <div className={cn('flex flex-wrap items-center gap-2', isUser && 'justify-end')}>
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
                      {message.executionSummaryLabel ? ` · ${message.executionSummaryLabel}` : null}
                    </div>
                    <ChatMessageActions message={message} texts={texts} />
                  </>
                )}
              </div>
            </div>
            {isUser ? <ChatMessageAvatar role={message.role} /> : null}
          </div>
        );
      })}

      {isSending && !hasRenderableAssistantDraft ? (
        <div data-chat-message-layout={layout} className="flex justify-start gap-3">
          <ChatMessageAvatar
            assistantIcon={assistantAvatarIcon}
            role="assistant"
            size={layout === "flat" ? "compact" : "default"}
          />
          <ChatTypingIndicator label={texts.typingLabel} layout={layout} />
        </div>
      ) : null}
    </div>
  );
}
