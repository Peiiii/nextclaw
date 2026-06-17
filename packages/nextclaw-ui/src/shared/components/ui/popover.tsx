import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '@/shared/lib/utils';

const FLOATING_CONTENT_AVAILABLE_HEIGHT_GAP = '2rem';

function createPopoverAvailableHeightLimit(limit: string): string {
  return `min(${limit}, max(0px, calc(var(--radix-popover-content-available-height, 100vh) - ${FLOATING_CONTENT_AVAILABLE_HEIGHT_GAP})))`;
}

const POPOVER_CONTENT_MAX_HEIGHT = createPopoverAvailableHeightLimit('24rem');

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, sideOffset = 8, align = 'start', collisionPadding = 12, style, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      collisionPadding={collisionPadding}
      className={cn(
        'z-[var(--z-popover,50)] w-72 overflow-x-hidden overflow-y-auto rounded-2xl border border-gray-200/50 bg-white p-4 shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className
      )}
      style={{ maxHeight: POPOVER_CONTENT_MAX_HEIGHT, ...style }}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  createPopoverAvailableHeightLimit,
};
