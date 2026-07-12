import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';

type IconActionButtonSize = 'sm' | 'md' | 'lg';
type IconActionButtonTone = 'default' | 'strong';

type IconActionButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'type'
> & {
  icon: React.ReactNode;
  label: string;
  size?: IconActionButtonSize;
  /** default: soft accent hover. strong: denser gray hover for nested hover surfaces. */
  tone?: IconActionButtonTone;
  tooltip?: string | false | null;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
};

const SIZE_CLASS: Record<IconActionButtonSize, string> = {
  sm: 'h-6 w-6 rounded-md p-1',
  md: 'h-7 w-7 rounded-md p-1.5',
  lg: 'h-8 w-8 rounded-lg p-1.5',
};

const TONE_CLASS: Record<IconActionButtonTone, string> = {
  default:
    'text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:text-muted-foreground/45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/45',
  strong:
    'text-muted-foreground hover:bg-black/10 hover:text-foreground disabled:text-muted-foreground/45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/45',
};

const IconActionButton = React.forwardRef<HTMLButtonElement, IconActionButtonProps>(
  (
    {
      className,
      disabled = false,
      icon,
      label,
      size = 'md',
      tone = 'default',
      tooltip,
      tooltipSide = 'bottom',
      ...buttonProps
    },
    ref
  ) => {
    const button = (
      <button
        {...buttonProps}
        ref={ref}
        type="button"
        disabled={disabled}
        aria-label={label}
        className={cn(
          'inline-flex shrink-0 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed',
          SIZE_CLASS[size],
          TONE_CLASS[tone],
          className
        )}
      >
        {icon}
      </button>
    );
    const content = tooltip === false ? null : tooltip ?? label;
    if (!content) return button;
    return (
      <TooltipProvider delayDuration={250}>
        <Tooltip>
          <TooltipTrigger asChild>
            {disabled ? <span className="inline-flex">{button}</span> : button}
          </TooltipTrigger>
          <TooltipContent side={tooltipSide} className="text-xs">{content}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);
IconActionButton.displayName = 'IconActionButton';

export { IconActionButton };
export type { IconActionButtonProps, IconActionButtonSize, IconActionButtonTone };
