import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const settingRowVariants = cva(
  "flex items-start justify-between gap-4 rounded-xl border p-4",
  {
    variants: {
      tone: {
        default: "border-gray-200 bg-white",
        muted: "border-gray-200 bg-gray-50",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  },
);

export interface SettingRowProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof settingRowVariants> {
  title: React.ReactNode;
  description?: React.ReactNode;
  control?: React.ReactNode;
}

export const SettingRow = React.forwardRef<HTMLDivElement, SettingRowProps>(
  (
    { className, tone, title, description, control, children, ...props },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(settingRowVariants({ tone }), className)}
      {...props}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="text-sm font-medium text-gray-900">{title}</div>
        {description ? (
          <p className="text-sm leading-6 text-gray-500">{description}</p>
        ) : null}
        {children}
      </div>
      {control ? <div className="shrink-0">{control}</div> : null}
    </div>
  ),
);

SettingRow.displayName = "SettingRow";
