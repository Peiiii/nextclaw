import { cn } from '../../../internal/cn';
import type { ReactNode } from 'react';

export function ToolCardRoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div 
      className={cn(
        "my-2 rounded-lg border border-amber-200/50 bg-amber-100/30 shadow-sm overflow-hidden text-[12px]",
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
    <div className={cn("border-t border-amber-200/15 bg-amber-50/50 px-3 pt-1 pb-2 w-full overflow-hidden", className)}>
      {children}
    </div>
  );
}
