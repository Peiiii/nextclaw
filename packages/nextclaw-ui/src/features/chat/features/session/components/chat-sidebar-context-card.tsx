import type { ReactElement, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";

export type ChatSidebarContextMetric = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
};

export function ChatSidebarContextCard({
  children,
  metrics,
  title,
}: {
  children: ReactElement;
  metrics: readonly ChatSidebarContextMetric[];
  title: string;
}) {
  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          sideOffset={10}
          collisionPadding={12}
          className="pointer-events-none w-64 rounded-xl border-border/80 bg-popover p-3 text-popover-foreground shadow-[0_18px_48px_-24px_rgba(15,23,42,0.45)]"
        >
          <div className="truncate text-sm font-semibold leading-5">
            {title}
          </div>
          <div className="mt-2 space-y-0.5">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="flex h-5 min-w-0 items-center gap-2 text-xs leading-5"
              >
                <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
                  {metric.icon}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {metric.label}
                </span>
                <span className="min-w-0 max-w-40 truncate tabular-nums text-foreground/80">
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
