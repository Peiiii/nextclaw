import * as React from 'react';
import { cn } from '@/shared/lib/utils';

interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const SCROLL_BOTTOM_EDGE_FADE_CLASS = '[mask-image:linear-gradient(to_bottom,black_calc(100%_-_28px),transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black_calc(100%_-_28px),transparent)]';

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('overflow-auto', className)}
      {...props}
    >
      {children}
    </div>
  )
);
ScrollArea.displayName = 'ScrollArea';

export { ScrollArea };
