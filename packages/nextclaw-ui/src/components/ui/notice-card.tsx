import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const noticeCardVariants = cva("rounded-2xl border px-4 py-3", {
  variants: {
    tone: {
      neutral: "border-gray-200 bg-gray-50 text-gray-900",
      success: "border-emerald-200 bg-emerald-50 text-emerald-900",
      warning: "border-amber-200 bg-amber-50 text-amber-900",
      danger: "border-rose-200 bg-rose-50 text-rose-700",
      info: "border-primary/20 bg-primary/10 text-primary",
    },
    borderStyle: {
      solid: "",
      dashed: "border-dashed",
    },
  },
  defaultVariants: {
    tone: "neutral",
    borderStyle: "solid",
  },
});

const titleClassMap: Record<
  NonNullable<VariantProps<typeof noticeCardVariants>["tone"]>,
  string
> = {
  neutral: "text-gray-900",
  success: "text-emerald-800",
  warning: "text-amber-900",
  danger: "text-rose-700",
  info: "text-primary",
};

const descriptionClassMap: Record<
  NonNullable<VariantProps<typeof noticeCardVariants>["tone"]>,
  string
> = {
  neutral: "text-gray-600",
  success: "text-emerald-700",
  warning: "text-amber-800",
  danger: "text-rose-700",
  info: "text-primary/90",
};

export interface NoticeCardProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof noticeCardVariants> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}

export const NoticeCard = React.forwardRef<HTMLDivElement, NoticeCardProps>(
  (
    {
      className,
      tone = "neutral",
      borderStyle = "solid",
      title,
      description,
      icon,
      actions,
      children,
      ...props
    },
    ref,
  ) => {
    const resolvedTone = tone ?? "neutral";
    const hasHeader =
      Boolean(title) ||
      Boolean(description) ||
      Boolean(icon) ||
      Boolean(actions);

    return (
      <div
        ref={ref}
        className={cn(
          noticeCardVariants({ tone: resolvedTone, borderStyle }),
          className,
        )}
        {...props}
      >
        {hasHeader ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                {icon ? <div className="mt-0.5 shrink-0">{icon}</div> : null}
                <div className="min-w-0 flex-1">
                  {title ? (
                    <p
                      className={cn(
                        "text-sm font-medium",
                        titleClassMap[resolvedTone],
                      )}
                    >
                      {title}
                    </p>
                  ) : null}
                  {description ? (
                    <p
                      className={cn(
                        title ? "mt-1" : "",
                        "text-sm leading-6",
                        descriptionClassMap[resolvedTone],
                      )}
                    >
                      {description}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        ) : null}
        {children ? (
          <div className={cn(hasHeader ? "mt-3" : "")}>{children}</div>
        ) : null}
      </div>
    );
  },
);

NoticeCard.displayName = "NoticeCard";
