import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const tagChipVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
  {
    variants: {
      tone: {
        subtle: "border-gray-200 bg-gray-50 text-gray-600",
        neutral: "border-gray-200 bg-white text-gray-600",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
        danger: "border-rose-200 bg-rose-50 text-rose-600",
        info: "border-primary/20 bg-primary/10 text-primary",
      },
    },
    defaultVariants: {
      tone: "subtle",
    },
  },
);

export interface TagChipProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof tagChipVariants> {}

export const TagChip = React.forwardRef<HTMLSpanElement, TagChipProps>(
  ({ className, tone, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(tagChipVariants({ tone }), className)}
      {...props}
    />
  ),
);

TagChip.displayName = "TagChip";
