import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { ACTION_FEEDBACK, ACTION_MENU_ITEM_CLASS } from '@/shared/components/ui/actions/action-feedback';

type ChatSessionHeaderMenuItemProps = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  selected?: boolean;
};

export function ChatSessionHeaderMenuItem({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  destructive = false,
  selected,
}: ChatSessionHeaderMenuItemProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        ACTION_MENU_ITEM_CLASS,
        destructive
          ? ACTION_FEEDBACK.destructive
          : `text-foreground ${ACTION_FEEDBACK.item}`,
        selected && 'bg-[var(--interaction-selection)]',
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className={cn("h-4 w-4 shrink-0", !destructive && "text-muted-foreground")} />
      <span>{label}</span>
    </button>
  );
}
