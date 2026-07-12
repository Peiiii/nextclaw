import { Check, Loader2, AlertTriangle, Minus } from 'lucide-react';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';
import type { ChatToolPartViewModel } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

export const STATUS_STYLES = {
  running: { text: 'text-muted-foreground', icon: Loader2, spin: true },
  success: { text: 'text-muted-foreground/75', icon: Check, spin: false },
  error: { text: 'text-destructive', icon: AlertTriangle, spin: false },
  cancelled: { text: 'text-muted-foreground/70', icon: Minus, spin: false }
} as const;

export function ToolStatusLabel({
  card,
  iconOnly = false,
}: {
  card: ChatToolPartViewModel;
  iconOnly?: boolean;
}) {
  const style = STATUS_STYLES[card.statusTone] || STATUS_STYLES.cancelled;
  const Icon = style.icon;
  const showLabel = !iconOnly && (card.statusTone === 'running' || card.statusTone === 'error');

  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1 text-[0.925rem] font-normal leading-[1.72]', style.text)}
      aria-label={iconOnly ? card.statusLabel : undefined}
    >
      <Icon
        aria-hidden="true"
        className={cn('h-[1.05em] w-[1.05em]', style.spin && 'animate-spin')}
        strokeWidth={2.25}
      />
      {showLabel ? card.statusLabel : null}
    </span>
  );
}
