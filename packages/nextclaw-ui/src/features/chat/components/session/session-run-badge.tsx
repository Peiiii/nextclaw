import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';
import type { SessionRunStatus } from '@/features/chat/types/session-run-status.types';

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
