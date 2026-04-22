import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const CARD_CLASS = "min-w-0 overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-card xl:h-[calc(100vh-180px)] xl:max-h-[860px]";
type DivProps = HTMLAttributes<HTMLDivElement>; type SectionProps = HTMLAttributes<HTMLElement>;

function ConfigSplitPane({ className, ...props }: SectionProps) {
  return <section className={cn(CARD_CLASS, "flex flex-col", className)} {...props} />;
}

export function ConfigSplitPage({ className, ...props }: DivProps) {
  return (
    <div
      className={cn(
        "grid min-h-0 grid-cols-1 gap-5 xl:flex-1 xl:grid-cols-[340px_minmax(0,1fr)]",
        className,
      )}
      {...props}
    />
  );
}

export { ConfigSplitPane as ConfigSplitSidebar, ConfigSplitPane as ConfigSplitDetailPane };

export function ConfigSplitEmptyPane({ className, ...props }: SectionProps) {
  return (
    <section
      className={cn(CARD_CLASS, "flex items-center justify-center px-6 py-12 text-center", className)}
      {...props}
    />
  );
}

export function ConfigSplitPaneHeader({ className, ...props }: DivProps) {
  return <div className={cn("shrink-0 border-b border-gray-100", className)} {...props} />;
}

export function ConfigSplitPaneBody({
  className,
  scrollOnDesktop = true,
  ...props
}: DivProps & { scrollOnDesktop?: boolean }) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1",
        scrollOnDesktop && "overflow-visible xl:overflow-y-auto xl:overscroll-contain",
        className,
      )}
      {...props}
    />
  );
}

export function ConfigSplitPaneFooter({ className, ...props }: DivProps) {
  return <div className={cn("shrink-0 border-t border-gray-100", className)} {...props} />;
}

export function ConfigSelectionCard({
  active = false,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type={type}
      className={cn(
        "w-full rounded-xl border p-2.5 text-left transition-all",
        active
          ? "border-primary/30 bg-primary-50/40 shadow-sm"
          : "border-gray-200/70 bg-white hover:border-gray-300 hover:bg-gray-50/70",
        className,
      )}
      {...props}
    />
  );
}

export function ConfigSplitEmptyState({
  icon: Icon,
  title,
  description,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/70 px-4 py-10 text-center",
        className,
      )}
      {...props}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white">
        <Icon className="h-5 w-5 text-gray-300" />
      </div>
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description ? <p className="mt-2 text-xs text-gray-500">{description}</p> : null}
    </div>
  );
}
