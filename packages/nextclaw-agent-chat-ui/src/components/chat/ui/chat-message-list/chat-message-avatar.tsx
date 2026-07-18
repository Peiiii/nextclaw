import type { ReactNode } from 'react';
import type { ChatMessageRole } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { Bot, User, Wrench } from 'lucide-react';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';

export function ChatMessageAvatar({
  assistantIcon,
  role,
  size = 'default',
}: {
  assistantIcon?: ReactNode;
  role: ChatMessageRole;
  size?: 'default' | 'compact';
}) {
  const compact = size === 'compact';
  const frameSize = compact ? 'h-7 w-7' : 'h-8 w-8';
  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';
  if (role === 'user') {
    return (
      <div
        data-testid="chat-message-avatar-user"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm',
          frameSize,
        )}
      >
        <User className={iconSize} />
      </div>
    );
  }
  if (role === 'tool') {
    return (
      <div
        data-testid="chat-message-avatar-tool"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm ring-1 ring-border',
          frameSize,
        )}
      >
        <Wrench className={iconSize} />
      </div>
    );
  }
  return (
    <div
      data-testid="chat-message-avatar-assistant"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-muted text-foreground shadow-sm ring-1 ring-border',
        frameSize,
      )}
    >
      {assistantIcon ?? (
        <Bot
          className={cn(compact ? 'h-4 w-4' : 'h-[18px] w-[18px]', 'text-current')}
          strokeWidth={2.5}
        />
      )}
    </div>
  );
}
