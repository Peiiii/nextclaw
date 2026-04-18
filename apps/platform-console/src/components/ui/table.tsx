import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function TableWrap({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div className={cn('overflow-auto rounded-xl border border-[#e4e0d7]', className)} {...props} />;
}
