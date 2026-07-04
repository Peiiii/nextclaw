import * as React from "react";
import { X } from "lucide-react";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

export type CompactTabStripTab = {
  key: string;
  label: string;
  active: boolean;
  tooltip?: string | null;
  leadingIcon?: React.ReactNode;
  badge?: React.ReactNode;
  unreadIndicator?: React.ReactNode;
  closeLabel?: string;
  closePlacement?: "leading-hover" | "trailing";
  onSelect: () => void;
  onClose?: () => void;
};

export type CompactTabStripAction = {
  key: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

type CompactTabStripProps = {
  tabs: readonly CompactTabStripTab[];
  actions: readonly CompactTabStripAction[];
  className?: string;
  scrollClassName?: string;
  tabsClassName?: string;
  actionsClassName?: string;
  actionButtonClassName?: string;
  tabBaseClassName?: string;
  activeTabClassName?: string;
  inactiveTabClassName?: string;
  labelClassName?: string;
  testId?: string;
  scrollTestId?: string;
  actionsTestId?: string;
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  onScrollPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
};

function closeCompactTab(event: React.MouseEvent<HTMLButtonElement>, onClose: () => void) {
  event.stopPropagation();
  onClose();
}

function CompactTabLabelButton({
  labelClassName,
  tab,
}: {
  labelClassName?: string;
  tab: CompactTabStripTab;
}) {
  const leadingIcon = tab.onClose && tab.closePlacement === "leading-hover"
    ? null
    : tab.leadingIcon;
  const button = (
    <button
      type="button"
      onClick={tab.onSelect}
      aria-label={tab.label}
      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
    >
      {leadingIcon ? (
        <span className="inline-flex shrink-0 items-center justify-center">
          {leadingIcon}
        </span>
      ) : null}
      <span className={cn("min-w-0 truncate text-[12px] font-medium", labelClassName)}>
        {tab.label}
      </span>
      {tab.badge}
      {tab.unreadIndicator}
    </button>
  );
  const tooltip = tab.tooltip ?? tab.label;

  if (!tooltip) {
    return button;
  }

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CompactTabItem({
  activeTabClassName,
  inactiveTabClassName,
  itemRef,
  labelClassName,
  tab,
  tabBaseClassName,
}: Pick<
  CompactTabStripProps,
  | "activeTabClassName"
  | "inactiveTabClassName"
  | "labelClassName"
  | "tabBaseClassName"
> & { itemRef?: React.Ref<HTMLDivElement>; tab: CompactTabStripTab }) {
  const leadingClose = tab.onClose && tab.closePlacement === "leading-hover";
  return (
    <div
      ref={itemRef}
      onClick={(event) => event.target === event.currentTarget && tab.onSelect()}
      className={cn(
        tabBaseClassName ??
          "group flex max-w-[180px] min-w-0 cursor-pointer items-center gap-1.5 border-r border-gray-200/70 border-b-2 px-2.5 py-2 transition-colors",
        tab.active
          ? (activeTabClassName ?? "border-b-primary bg-white text-gray-900")
          : (inactiveTabClassName ??
            "border-b-transparent bg-gray-50/85 text-gray-500 hover:bg-gray-100"),
      )}
    >
      {leadingClose ? (
        <button
          type="button"
          onClick={(event) => closeCompactTab(event, tab.onClose!)}
          className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
          aria-label={tab.closeLabel}
        >
          <span className="flex items-center justify-center group-hover:hidden">
            {tab.leadingIcon}
          </span>
          <X className="hidden h-3.5 w-3.5 group-hover:block" />
        </button>
      ) : null}
      <CompactTabLabelButton tab={tab} labelClassName={labelClassName} />
      {tab.onClose && tab.closePlacement !== "leading-hover" ? (
        <IconActionButton
          icon={<X className="h-3 w-3" />}
          label={tab.closeLabel ?? ""}
          tooltip={tab.closeLabel ?? null}
          onClick={(event) => closeCompactTab(event, tab.onClose!)}
          className="h-5 w-5 rounded p-0.5 hover:bg-black/10"
        />
      ) : null}
    </div>
  );
}

export function CompactTabStrip({
  actionButtonClassName,
  actions,
  actionsClassName,
  actionsTestId,
  className,
  onPointerDown,
  onScrollPointerDown,
  scrollClassName,
  scrollTestId,
  tabs,
  tabsClassName,
  testId,
  ...tabProps
}: CompactTabStripProps) {
  const scrollActiveItemIntoView = React.useCallback((item: HTMLDivElement | null) => {
    item?.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
    });
  }, []);

  return (
    <div
      data-testid={testId}
      className={cn(
        "flex min-w-0 items-stretch border-b border-gray-200/70 bg-gray-50/85",
        className,
      )}
      onPointerDown={onPointerDown}
    >
      <div
        className={cn(
          "min-w-0 flex-1 overflow-x-auto overflow-y-hidden",
          scrollClassName,
        )}
        onPointerDown={onScrollPointerDown}
      >
        <div
          data-testid={scrollTestId}
          className={cn("flex min-w-max items-stretch", tabsClassName)}
        >
          {tabs.map((tab) => (
            <CompactTabItem
              key={tab.key}
              itemRef={tab.active ? scrollActiveItemIntoView : undefined}
              tab={tab}
              {...tabProps}
            />
          ))}
        </div>
      </div>
      <div
        className={cn("flex shrink-0 items-center gap-1", actionsClassName)}
        data-testid={actionsTestId}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {actions.map((action) => (
          <IconActionButton
            key={action.key}
            icon={action.icon}
            label={action.label}
            disabled={action.disabled}
            onClick={action.onClick}
            className={actionButtonClassName}
          />
        ))}
      </div>
    </div>
  );
}
