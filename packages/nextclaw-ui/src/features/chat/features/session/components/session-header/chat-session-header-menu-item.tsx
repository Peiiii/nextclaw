import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

type ChatSessionHeaderMenuItemProps = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

export function ChatSessionHeaderMenuItem({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  destructive = false,
}: ChatSessionHeaderMenuItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[13px] font-medium outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        destructive
          ? 'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10'
          : 'text-foreground hover:bg-muted focus-visible:bg-muted'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className={cn("h-4 w-4 shrink-0", !destructive && "text-muted-foreground")} />
      <span>{label}</span>
    </button>
  );
}
