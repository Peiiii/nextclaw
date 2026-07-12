import type { HTMLAttributes } from 'react';
import { cn } from '@/shared/lib/utils';

type FormActionsProps = HTMLAttributes<HTMLDivElement> & {
  align?: 'start' | 'end' | 'between';
};

export function FormActions({
  align = 'end',
  className,
  ...props
}: FormActionsProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        align === 'start' && 'justify-start',
        align === 'end' && 'justify-end',
        align === 'between' && 'justify-between',
        className,
      )}
      {...props}
    />
  );
}
