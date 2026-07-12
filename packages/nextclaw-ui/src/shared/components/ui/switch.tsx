import * as React from 'react';
import { cn } from '@/shared/lib/utils';

interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  thumbClassName?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, thumbClassName, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        data-state={checked ? 'checked' : 'unchecked'}
        ref={ref}
        className={cn(
          'switch-track peer inline-flex h-[22px] w-10 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'border-primary/70 bg-primary' : 'border-border/60 bg-muted hover:bg-accent',
          className
        )}
        onClick={() => onCheckedChange?.(!checked)}
        {...props}
      >
        <span
          data-state={checked ? 'checked' : 'unchecked'}
          className={cn(
            'switch-thumb pointer-events-none block h-5 w-5 rounded-full bg-card shadow-md ring-1 ring-border/50 transition-transform duration-fast',
            checked ? 'translate-x-5' : 'translate-x-0',
            thumbClassName
          )}
        />
      </button>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
