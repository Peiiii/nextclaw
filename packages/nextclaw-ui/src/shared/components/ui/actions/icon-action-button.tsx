import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

type IconActionButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'type'
> & {
  icon: React.ReactNode;
  label: string;
  tooltip?: string | null;
};

const IconActionButton = React.forwardRef<HTMLButtonElement, IconActionButtonProps>(
  ({ className, disabled = false, icon, label, tooltip, ...buttonProps }, ref) => {
    const button = (
      <button
        {...buttonProps}
        ref={ref}
        type="button"
        disabled={disabled}
        aria-label={label}
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed',
          'text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-300 disabled:hover:bg-transparent disabled:hover:text-gray-300',
          className
        )}
      >
        {icon}
      </button>
    );
    const content = tooltip ?? label;
    if (!content) return button;
    return (
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>
            {disabled ? <span className="inline-flex">{button}</span> : button}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">{content}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);
IconActionButton.displayName = 'IconActionButton';

export { IconActionButton };
