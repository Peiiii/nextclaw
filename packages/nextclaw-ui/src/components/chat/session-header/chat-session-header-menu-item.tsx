import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-gray-700 hover:bg-gray-100'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
