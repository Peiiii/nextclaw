import { Children, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

const CARD_CLASS = "min-w-0 overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-card xl:h-[calc(100vh-180px)] xl:max-h-[860px]";
type DivProps = HTMLAttributes<HTMLDivElement>; type SectionProps = HTMLAttributes<HTMLElement>;

function ConfigSplitPane({ className, ...props }: SectionProps) {
  return <section className={cn(CARD_CLASS, "flex flex-col", className)} {...props} />;
}

export function ConfigSplitPage({
  className,
  children,
  mobileView,
  onMobileBack,
  mobileListLabel,
  ...props
}: DivProps & {
  mobileView?: "list" | "detail";
  onMobileBack?: () => void;
  mobileListLabel?: string;
}) {
  const childArray = Children.toArray(children);
  const [sidebarChild, detailChild, ...remainingChildren] = childArray;

  if (mobileView && sidebarChild && detailChild) {
    return (
      <div
        className={cn("grid min-h-0 grid-cols-1 gap-4", className)}
        {...props}
      >
        {mobileView === "detail" ? (
          <>
            <div className="shrink-0">
              <button
                type="button"
                onClick={onMobileBack}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>{mobileListLabel ?? t("backToMain")}</span>
              </button>
            </div>
            {detailChild}
            {remainingChildren}
          </>
        ) : (
          <>
            {sidebarChild}
            {remainingChildren}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid min-h-0 grid-cols-1 gap-5 xl:flex-1 xl:grid-cols-[340px_minmax(0,1fr)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
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
