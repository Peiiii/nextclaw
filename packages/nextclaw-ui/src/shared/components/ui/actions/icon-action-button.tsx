import * as React from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { ACTION_FEEDBACK } from './action-feedback';

type IconActionButtonSize = 'sm' | 'md' | 'lg';
type IconActionButtonTone = 'default' | 'surface' | 'strong';

type IconActionButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'type'
> & {
  icon: React.ReactNode;
  label: string;
  size?: IconActionButtonSize;
  /** @deprecated All neutral icon actions now share the theme feedback color. */
  tone?: IconActionButtonTone;
  tooltip?: string | false | null;
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left';
};

const SIZE_CLASS: Record<IconActionButtonSize, string> = {
  sm: 'h-6 w-6 rounded-md p-1',
  md: 'h-7 w-7 rounded-md p-1.5',
  lg: 'h-8 w-8 rounded-lg p-1.5',
};

export function IconActionGroup({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn('flex shrink-0 items-center gap-1 max-md:gap-0', className)}>{children}</div>;
}

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
        data-tone={tone}
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border disabled:cursor-not-allowed',
          SIZE_CLASS[size],
          'text-muted-foreground hover:text-accent-foreground disabled:text-muted-foreground/45 disabled:hover:text-muted-foreground/45',
          ACTION_FEEDBACK.icon,
          size === 'sm' ? 'max-md:h-8 max-md:w-8' : 'max-md:h-[var(--icon-control-size)] max-md:w-[var(--icon-control-size)]',
          "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:transition-colors before:content-[''] max-md:before:inset-auto max-md:before:h-[var(--icon-feedback-size)] max-md:before:w-[var(--icon-feedback-size)]",
          size === 'sm' && 'max-md:before:h-7 max-md:before:w-7',
          className
        )}
      >
        <span className="relative inline-flex items-center justify-center">{icon}</span>
      </button>
    );
    const content = tooltip === false ? null : tooltip ?? label;
    if (!content) return button;
    return (
      <TooltipProvider delayDuration={250}>
        <Tooltip disableHoverableContent>
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
