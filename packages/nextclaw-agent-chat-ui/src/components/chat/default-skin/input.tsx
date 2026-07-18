import * as React from 'react';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';

export type ChatInputProps = React.InputHTMLAttributes<HTMLInputElement>;

const ChatInput = React.forwardRef<HTMLInputElement, ChatInputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn(
      'flex h-9 w-full rounded-xl border border-border bg-card px-3.5 py-2 text-sm text-foreground file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/55 placeholder:font-normal focus:outline-none focus:ring-0 focus:border-border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    ref={ref}
    {...props}
  />
));

ChatInput.displayName = 'ChatInput';

export { ChatInput };
