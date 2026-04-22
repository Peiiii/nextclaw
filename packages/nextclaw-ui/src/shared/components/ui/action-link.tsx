import { cn } from '@/shared/lib/utils';
import { ArrowRight } from 'lucide-react';

interface ActionLinkProps {
    label: string;
    className?: string;
    onClick?: () => void;
}

/**
 * Unified action link with arrow indicator.
 * Used in card footers for "Configure →", "Enable →", etc.
 */
export function ActionLink({ label, className, onClick }: ActionLinkProps) {
    return (
        <span
            onClick={onClick}
            className={cn(
                'inline-flex items-center gap-1 text-[13px] font-medium text-gray-600 hover:text-primary transition-colors cursor-pointer group/action',
                className
            )}
        >
            {label}
            <ArrowRight className="h-3 w-3 transition-transform group-hover/action:translate-x-0.5" />
        </span>
    );
}
