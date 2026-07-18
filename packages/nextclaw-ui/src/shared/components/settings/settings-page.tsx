import type { ReactNode } from 'react';
import { PageHeader, PageLayout } from '@/app/components/layout/page-layout';
import { cn } from '@/shared/lib/utils';

export interface SettingsPageProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  layout?: 'standard' | 'split';
  className?: string;
}

export function SettingsPage({
  actions,
  children,
  className,
  description,
  layout = 'standard',
  title
}: SettingsPageProps) {
  return (
    <PageLayout
      className={cn(
        'w-full space-y-6',
        layout === 'split' && 'pb-0 md:flex md:h-full md:min-h-0 md:flex-col',
        className
      )}
    >
      <PageHeader title={title} description={description} actions={actions} className='mb-0' />
      {children}
    </PageLayout>
  );
}
