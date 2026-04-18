import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      {...props}
      className={cn(
        'h-10 w-full rounded-lg border border-[#d9d3c5] bg-white px-3 text-sm text-[#1f1f1d] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
        className
      )}
    />
  );
}
