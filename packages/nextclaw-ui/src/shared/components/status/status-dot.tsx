import { cn } from '@/shared/lib/utils';

type StatusType = 'active' | 'inactive' | 'ready' | 'setup' | 'warning';

interface StatusDotProps {
    status: StatusType;
    label: string;
    className?: string;
}

const statusStyles: Record<StatusType, { dot: string; text: string; bg: string }> = {
    active: {
        dot: 'bg-emerald-500',
        text: 'text-emerald-600',
        bg: 'bg-emerald-50',
    },
    ready: {
        dot: 'bg-emerald-500',
        text: 'text-emerald-600',
        bg: 'bg-emerald-50',
    },
    inactive: {
        dot: 'bg-gray-300',
        text: 'text-gray-400',
        bg: 'bg-gray-100/80',
    },
    setup: {
        dot: 'bg-gray-300',
        text: 'text-gray-400',
        bg: 'bg-gray-100/80',
    },
    warning: {
        dot: 'bg-amber-400',
        text: 'text-amber-600',
        bg: 'bg-amber-50',
    },
};

/**
 * Unified status indicator with dot + label.
 * Used consistently across Channels, Providers, etc.
 */
export function StatusDot({ status, label, className }: StatusDotProps) {
    const style = statusStyles[status];
    return (
        <div className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5', style.bg, className)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
            <span className={cn('text-[11px] font-medium', style.text)}>{label}</span>
        </div>
    );
}
