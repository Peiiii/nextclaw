import { cn } from '@/lib/utils';

type Status = 'connected' | 'disconnected' | 'connecting';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<
  Status,
  { label: string; color: string }
> = {
  connected: { label: '已连接', color: 'bg-green-500' },
  disconnected: { label: '未连接', color: 'bg-gray-400' },
  connecting: { label: '连接中...', color: 'bg-yellow-500' }
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className={cn('h-2 w-2 rounded-full', config.color)} />
      <span className="text-sm text-muted-foreground">{config.label}</span>
    </div>
  );
}
