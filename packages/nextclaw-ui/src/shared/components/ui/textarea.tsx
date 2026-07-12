import * as React from "react";
import { cn } from "@/shared/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-28 w-full rounded-xl border border-border/75 bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/55 placeholder:font-normal transition-colors focus:outline-none focus:ring-0 focus:border-border disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
