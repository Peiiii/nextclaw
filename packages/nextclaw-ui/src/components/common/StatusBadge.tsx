import { cn } from '@/lib/utils';
import { Check, X, Loader2 } from 'lucide-react';
import { t } from '@/lib/i18n';

type Status = 'connected' | 'disconnected' | 'connecting';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<
  Status,
  { label: string; dotClass: string; textClass: string; bgClass: string; icon: typeof Check }
> = {
  connected: {
    label: t('connected'),
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
    icon: Check
  },
  disconnected: {
    label: t('disconnected'),
    dotClass: 'bg-gray-400',
    textClass: 'text-gray-500',
    bgClass: 'bg-gray-100',
    icon: X
  },
  connecting: {
    label: t('connecting'),
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    icon: Loader2
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-full',
      config.bgClass,
      className
    )}>
      <div className={cn('h-2 w-2 rounded-full', config.dotClass)} />
      <span className={cn('text-xs font-medium flex items-center gap-1', config.textClass)}>
        {config.label}
        {status === 'connecting' && <Icon className="h-3 w-3 animate-spin" />}
      </span>
    </div>
  );
}
