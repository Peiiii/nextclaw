import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const settingRowVariants = cva(
  'grid min-h-16 grid-cols-1 gap-3 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6',
  {
    variants: {
      tone: {
        default: '',
        muted: 'bg-muted/55'
      },
      layout: {
        responsive: '',
        stacked: 'sm:grid-cols-1 sm:items-start sm:gap-3'
      }
    },
    defaultVariants: {
      tone: 'default',
      layout: 'responsive'
    }
  }
);

export interface SettingsSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export const SettingsSection = React.forwardRef<HTMLElement, SettingsSectionProps>(
  ({ actions, children, className, description, title, ...props }, ref) => (
    <section ref={ref} className={cn('space-y-2.5', className)} {...props}>
      {title || description || actions ? (
        <div className='flex items-end justify-between gap-4 px-1'>
          <div className='min-w-0'>
            {title ? <h3 className='text-sm font-semibold text-foreground'>{title}</h3> : null}
            {description ? <p className='mt-0.5 text-xs leading-5 text-muted-foreground'>{description}</p> : null}
          </div>
          {actions ? <div className='shrink-0'>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
);

SettingsSection.displayName = 'SettingsSection';

export const SettingsGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('divide-y divide-border/55 overflow-hidden rounded-2xl bg-muted/45 text-foreground', className)}
      {...props}
    />
  )
);

SettingsGroup.displayName = 'SettingsGroup';

export interface SettingRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>, VariantProps<typeof settingRowVariants> {
  title: React.ReactNode;
  description?: React.ReactNode;
  control?: React.ReactNode;
}

export const SettingRow = React.forwardRef<HTMLDivElement, SettingRowProps>(
  ({ className, layout, tone, title, description, control, children, ...props }, ref) => (
    <div ref={ref} className={cn(settingRowVariants({ layout, tone }), className)} {...props}>
      <div className='min-w-0'>
        <div className='text-sm font-medium text-foreground'>{title}</div>
        {description ? <p className='mt-0.5 text-xs leading-5 text-muted-foreground'>{description}</p> : null}
        {children ? <div className='mt-3'>{children}</div> : null}
      </div>
      {control ? <div className='min-w-0 sm:shrink-0'>{control}</div> : null}
    </div>
  )
);

SettingRow.displayName = 'SettingRow';
