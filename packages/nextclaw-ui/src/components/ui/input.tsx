import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-xl border border-gray-200/80 bg-white px-3.5 py-2 text-sm text-gray-900 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-300 placeholder:font-normal focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
