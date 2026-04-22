import React from 'react';
import { cn } from '@/shared/lib/utils';

/* ============================================================================
   PageLayout — Unified page container
   ============================================================================ */

interface PageLayoutProps {
    children: React.ReactNode;
    /** When true, the page fills the full viewport height (e.g. Sessions, Cron) */
    fullHeight?: boolean;
    className?: string;
}

export function PageLayout({ children, fullHeight = false, className }: PageLayoutProps) {
    return (
        <div
            className={cn(
                'animate-fade-in',
                fullHeight
                    ? 'h-[calc(100vh-80px)] w-full flex flex-col'
                    : 'pb-16',
                className
            )}
        >
            {children}
        </div>
    );
}

/* ============================================================================
   PageHeader — Unified page title + subtitle + optional actions
   ============================================================================ */

interface PageHeaderProps {
    title: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
    return (
        <div className={cn('flex items-center justify-between mb-6 shrink-0', className)}>
            <div>
                <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
                {description && (
                    <p className="text-sm text-gray-500 mt-1">{description}</p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
    );
}

/* ============================================================================
   PageBody — Unified body container (flex-1 when inside fullHeight layout)
   ============================================================================ */

interface PageBodyProps {
    children: React.ReactNode;
    className?: string;
}

export function PageBody({ children, className }: PageBodyProps) {
    return (
        <div className={cn('flex-1 min-h-0', className)}>
            {children}
        </div>
    );
}
