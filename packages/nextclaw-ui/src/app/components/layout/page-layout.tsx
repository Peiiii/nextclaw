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
    headingLevel?: 1 | 2;
    /** The mobile shell already provides the page title. */
    mobileTitleInShell?: boolean;
    className?: string;
}

export function PageHeader({
    title,
    description,
    actions,
    headingLevel = 2,
    mobileTitleInShell = false,
    className
}: PageHeaderProps) {
    const Heading = headingLevel === 1 ? 'h1' : 'h2';

    return (
        <header
            data-theme-surface="header"
            className={cn('flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}
        >
            <div className={cn("min-w-0", mobileTitleInShell && !description && "hidden md:block")}>
                <Heading className={cn("text-xl font-semibold tracking-tight text-foreground", mobileTitleInShell && "hidden md:block")}>{title}</Heading>
                {description && (
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
                )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
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
