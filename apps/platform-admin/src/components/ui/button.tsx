import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const variantClassMap: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-300',
  secondary: 'bg-[#f3f2ee] text-[#1f1f1d] hover:bg-[#e9e5dc] disabled:bg-[#f3f2ee]',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  ghost: 'bg-transparent text-[#656561] hover:bg-[#f3f2ee] disabled:text-[#b8b2a4]'
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
