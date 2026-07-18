import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variantClassMap: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-300',
  secondary: 'bg-[var(--color-surface-muted)] text-[var(--color-foreground)] hover:bg-[var(--color-surface-hover)] disabled:bg-[var(--color-surface-muted)]',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  ghost: 'bg-transparent text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface-muted)] disabled:text-[var(--color-foreground-disabled)]'
};

export function Button({ className, variant = 'primary', ...props }: Props): JSX.Element {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed',
        variantClassMap[variant],
        className
      )}
    />
  );
}
