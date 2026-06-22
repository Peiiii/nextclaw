import { Check, Loader2, AlertTriangle, Minus } from 'lucide-react';
import { cn } from '@agent-chat-ui/components/chat/internal/cn';
import type { ChatToolPartViewModel } from '@agent-chat-ui/components/chat/view-models/chat-ui.types';

export const STATUS_STYLES = {
  running: { text: 'text-primary/70', icon: Loader2, spin: true },
  success: { text: 'text-primary/70', icon: Check, spin: false },
  error: { text: 'text-destructive', icon: AlertTriangle, spin: false },
  cancelled: { text: 'text-muted-foreground', icon: Minus, spin: false }
} as const;

export function ToolStatusLabel({ card }: { card: ChatToolPartViewModel }) {
  const style = STATUS_STYLES[card.statusTone] || STATUS_STYLES.cancelled;
  const Icon = style.icon;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium leading-none shrink-0', style.text)}>
      <Icon className={cn("h-3.5 w-3.5", style.spin && "animate-spin")} strokeWidth={3} />
      {card.statusTone === 'running' ? card.statusLabel : null}
    </span>
  );
}
