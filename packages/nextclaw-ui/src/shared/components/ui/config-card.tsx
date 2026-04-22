import * as React from 'react';
import { cn } from '@/shared/lib/utils';

interface ConfigCardProps {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
}

/**
 * Unified config card used for Channels, Providers, etc.
 * Style follows YouMind: generous padding, large radius, soft shadow.
 */
export function ConfigCard({ children, onClick, className }: ConfigCardProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                'group relative flex flex-col p-6 rounded-2xl border border-gray-200/50 bg-white shadow-card',
                'transition-all duration-base cursor-pointer',
                'hover:shadow-card-hover hover:border-gray-200',
                className
            )}
        >
            {children}
        </div>
    );
}

interface ConfigCardHeaderProps {
    children: React.ReactNode;
    className?: string;
}

export function ConfigCardHeader({ children, className }: ConfigCardHeaderProps) {
    return (
        <div className={cn('flex items-start justify-between mb-4', className)}>
            {children}
        </div>
    );
}

interface ConfigCardBodyProps {
    title: string;
    description?: string;
    className?: string;
}

export function ConfigCardBody({ title, description, className }: ConfigCardBodyProps) {
    return (
        <div className={cn('flex-1', className)}>
            <h3 className="text-[14px] font-bold text-gray-900 mb-0.5">{title}</h3>
            {description && (
                <p className="text-[12px] text-gray-400 leading-relaxed line-clamp-2">{description}</p>
            )}
        </div>
    );
}

interface ConfigCardFooterProps {
    children: React.ReactNode;
    className?: string;
}

export function ConfigCardFooter({ children, className }: ConfigCardFooterProps) {
    return (
        <div className={cn('mt-4 pt-3 flex items-center justify-between', className)}>
            {children}
        </div>
    );
}
