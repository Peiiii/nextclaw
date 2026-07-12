import { cn } from '@agent-chat-ui/components/chat/internal/cn';
import type { ReactNode } from 'react';

/**
 * Default tool presentation is an inline process row, not a heavy card.
 * Expanded details sit under the overview text column with clear clearance
 * from any workflow rail in the icon column.
 */
export function ToolCardRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative my-0 flex w-full min-w-0 max-w-full flex-col text-[0.925rem] leading-[1.72] text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolCardContent({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        // Align every expanded panel with the overview text column. The rail
        // remains isolated in the leading icon column.
        'mt-0.5 w-full max-w-full min-w-0 overflow-hidden pl-[calc(1.15em+0.375rem)] text-[0.925rem] leading-[1.72] text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}
