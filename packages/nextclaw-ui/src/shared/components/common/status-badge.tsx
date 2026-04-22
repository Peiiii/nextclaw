import { cn } from '@/shared/lib/utils';
import { Loader2 } from 'lucide-react';
import { t } from '@/shared/lib/i18n';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

type Status = 'connected' | 'disconnected' | 'connecting';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<
  Status,
  { dotClass: string }
> = {
  connected: {
    dotClass: 'bg-emerald-500',
  },
  disconnected: {
    dotClass: 'h-2.5 w-2.5 rounded-full border border-gray-400 bg-transparent',
  },
  connecting: {
    dotClass: 'text-amber-600',
  }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const label = status === 'connected' ? t('connected') : status === 'disconnected' ? t('disconnected') : t('connecting');

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="status"
            aria-label={label}
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center',
              className
            )}
          >
            {status === 'connecting' ? (
              <Loader2 className={cn('h-3 w-3 animate-spin', config.dotClass)} />
            ) : (
              <span
                className={cn(
                  status === 'connected' ? 'h-2 w-2 rounded-full' : '',
                  config.dotClass
                )}
              />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
