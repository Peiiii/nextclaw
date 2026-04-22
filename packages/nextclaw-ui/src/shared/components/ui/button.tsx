import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-600 active:bg-primary-700 shadow-sm',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-gray-200 bg-white hover:bg-gray-50 hover:text-gray-800 text-gray-600',
        secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200/80',
        ghost: 'hover:bg-gray-100/80 hover:text-gray-800',
        link: 'text-primary underline-offset-4 hover:underline',
        primary: 'bg-primary text-primary-foreground hover:bg-primary-600 active:bg-primary-700 shadow-sm',
        subtle: 'bg-gray-100 text-gray-600 hover:bg-gray-200/80',
        'primary-outline': 'border border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground'
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-11 px-5 text-[14px]',
        xl: 'h-12 px-6 text-[15px]',
        icon: 'h-9 w-9'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
