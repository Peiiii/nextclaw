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

export function ToolCardDetailSection({
  label,
  tone,
  children,
}: {
  label: string;
  tone: 'input' | 'output' | 'error';
  children: ReactNode;
}) {
  const tones = {
    input: { dot: 'bg-muted-foreground/60', body: 'text-foreground' },
    output: { dot: 'bg-primary/70', body: 'text-foreground' },
    error: { dot: 'bg-rose-500/80', body: 'text-rose-950/85' },
  } as const;
  const style = tones[tone];

  return (
    <section className="overflow-hidden rounded-md border border-border/70 bg-muted/20">
      <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5 text-[10px] font-medium tracking-wide text-muted-foreground">
        <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
        <span className="normal-case tracking-normal">{label}</span>
      </div>
      <div className="w-full overflow-hidden">
        <pre
          className={cn(
            'w-full max-w-full min-w-0 max-h-64 overflow-x-auto overflow-y-auto px-2.5 py-2 font-mono text-[12px] leading-relaxed whitespace-pre custom-scrollbar',
            style.body,
          )}
        >
          {children}
        </pre>
      </div>
    </section>
  );
}
