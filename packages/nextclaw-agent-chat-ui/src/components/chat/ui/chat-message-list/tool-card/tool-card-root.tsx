import { cn } from '@agent-chat-ui/components/chat/internal/cn';
import type { ReactNode } from 'react';

export function ToolCardRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div 
      className={cn(
        "my-2 rounded-lg border border-border bg-card shadow-sm overflow-hidden text-[12px] text-card-foreground",
        "w-[280px] sm:w-[360px] md:w-[480px] min-w-full max-w-full transition-all flex flex-col",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ToolCardContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-t border-border bg-muted/35 px-3 pt-1 pb-2 w-full overflow-hidden", className)}>
      {children}
    </div>
  );
}
