import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export function AppDataRemovalChoice({
  checked,
  description,
  destructive = false,
  disabled = false,
  label,
  onClick,
}: {
  checked: boolean;
  description: string;
  destructive?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-foreground/25 bg-muted/55' : 'border-border/60 hover:bg-muted/35',
      )}
    >
      <span className={cn(
        'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
        checked ? 'border-foreground bg-foreground text-background' : 'border-border',
      )}>
        {checked ? <Check className="h-2.5 w-2.5" /> : null}
      </span>
      <span>
        <span className={cn('block text-sm font-medium', destructive ? 'text-destructive' : 'text-foreground')}>{label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
