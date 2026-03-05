import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';
import type { SessionRunStatus } from '@/lib/session-run-status';

type SessionRunBadgeProps = {
  status: SessionRunStatus;
  className?: string;
};

export function SessionRunBadge({ status, className }: SessionRunBadgeProps) {
  const label = status === 'running' ? t('sessionsRunStatusRunning') : t('sessionsRunStatusQueued');
  return (
    <span
      className={cn('inline-flex h-3.5 w-3.5 items-center justify-center text-gray-400', className)}
      title={label}
      aria-label={label}
    >
      <Loader2 className="h-3 w-3 animate-spin" />
      <span className="sr-only">{label}</span>
    </span>
  );
}
