import type { ChatMessageRole } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';
import { Bot, User, Wrench } from 'lucide-react';

export function ChatMessageAvatar({ role }: { role: ChatMessageRole }) {
  if (role === 'user') {
    return (
      <div
        data-testid="chat-message-avatar-user"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
      >
        <User className="h-4 w-4" />
      </div>
    );
  }
  if (role === 'tool') {
    return (
      <div
        data-testid="chat-message-avatar-tool"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm ring-1 ring-border"
      >
        <Wrench className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div
      data-testid="chat-message-avatar-assistant"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground shadow-sm ring-1 ring-border"
    >
      <Bot className="h-[18px] w-[18px] text-current" strokeWidth={2.5} />
    </div>
  );
}
