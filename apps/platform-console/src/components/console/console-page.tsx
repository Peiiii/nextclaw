import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ConsolePageProps = {
  children: ReactNode;
  className?: string;
};

type ConsoleSectionProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

type ConsoleSurfaceProps = HTMLAttributes<HTMLDivElement>;

type ConsoleMetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  className?: string;
};

export function ConsolePage({ children, className }: ConsolePageProps): JSX.Element {
  return <div className={cn('space-y-6', className)}>{children}</div>;
}

export function ConsoleSection({
  title,
  description,
  actions,
  children,
  className
}: ConsoleSectionProps): JSX.Element {
  return (
    <section className={cn('space-y-4', className)}>
      {title || description || actions ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            {title ? <h3 className="text-sm font-semibold text-[#1f1f1d]">{title}</h3> : null}
            {description ? <p className="text-sm leading-6 text-[#656561]">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function ConsoleSurface({ className, ...props }: ConsoleSurfaceProps): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[#e4e0d7] bg-white shadow-[0_1px_3px_rgba(31,31,29,0.04)]',
        className
      )}
      {...props}
    />
  );
}

export function ConsoleMetricGrid({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('grid gap-4 md:grid-cols-2 xl:grid-cols-4', className)} {...props} />;
}

export function ConsoleMetricCard({ label, value, hint, className }: ConsoleMetricCardProps): JSX.Element {
  return (
    <ConsoleSurface className={cn('p-5', className)}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8f8a7d]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-[#1f1f1d]">{value}</p>
      {hint ? <p className="mt-2 text-sm text-[#656561]">{hint}</p> : null}
    </ConsoleSurface>
  );
}
