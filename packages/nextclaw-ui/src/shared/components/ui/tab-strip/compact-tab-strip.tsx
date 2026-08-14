import * as React from "react";
import { MoreVertical, X } from "lucide-react";
import {
  IconActionButton,
  type IconActionButtonProps,
} from "@/shared/components/ui/actions/icon-action-button";
import {
  ContextMenu,
  ContextMenuTrigger,
  type ContextMenuGroup,
} from "@/shared/components/ui/context-menu/context-menu";
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
  labelClassName?: string;
  badge?: React.ReactNode;
  unreadIndicator?: React.ReactNode;
  closeLabel?: string;
  closePlacement?: "leading-hover" | "trailing";
  menuLabel?: string;
  menuGroups?: readonly ContextMenuGroup[];
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

function CompactTabActionButton(props: IconActionButtonProps) {
  return <IconActionButton {...props} size="sm" tone="strong" />;
}

function CompactTabMenu({ tab }: { tab: CompactTabStripTab }) {
  if (!tab.menuGroups?.some((group) => group.items.length > 0)) {
    return null;
  }

  const menuLabel = tab.menuLabel ?? tab.label;
  return (
    <div className="flex shrink-0">
      <ContextMenuTrigger>
        <CompactTabActionButton
          icon={<MoreVertical className="h-3.5 w-3.5" />}
          label={menuLabel}
        />
      </ContextMenuTrigger>
    </div>
  );
}

function CompactTabTrailingActions({ tab }: { tab: CompactTabStripTab }) {
  const hasMenu = tab.menuGroups?.some((group) => group.items.length > 0) ?? false;
  const hasTrailingClose = Boolean(
    tab.onClose && tab.closePlacement !== "leading-hover",
  );
  const close = hasTrailingClose ? (
    <CompactTabActionButton
      icon={<X className="h-3.5 w-3.5" />}
      label={tab.closeLabel ?? ""}
      tooltip={tab.closeLabel ?? null}
      onClick={(event) => closeCompactTab(event, tab.onClose!)}
    />
  ) : null;

  if (!hasMenu && !hasTrailingClose) {
    return null;
  }

  return (
    <>
      <span
        aria-hidden="true"
        data-compact-tab-trailing-spacer=""
        className={cn(
          "shrink-0",
          hasMenu && hasTrailingClose
            ? "w-[50px]"
            : hasMenu
              ? "w-6"
              : "w-6",
        )}
      />
      <div
        data-compact-tab-trailing-actions=""
        className={cn(
          "pointer-events-none absolute inset-y-0 right-1 z-10 flex items-center gap-0.5 opacity-0",
          "group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
          "group-data-[context-menu-open]:pointer-events-auto group-data-[context-menu-open]:opacity-100",
        )}
      >
        {hasMenu ? <CompactTabMenu tab={tab} /> : null}
        {close}
      </div>
    </>
  );
}

function CompactTabLeadingCloseOverlay({ tab }: { tab: CompactTabStripTab }) {
  if (!tab.onClose || tab.closePlacement !== "leading-hover") {
    return null;
  }

  return (
    <div
      data-compact-tab-leading-actions=""
      className={cn(
        "pointer-events-none absolute inset-y-0 left-1 z-10 flex items-center opacity-0",
        "group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
      )}
    >
      <CompactTabActionButton
        icon={<X className="h-3.5 w-3.5" />}
        label={tab.closeLabel ?? ""}
        tooltip={tab.closeLabel ?? null}
        onClick={(event) => closeCompactTab(event, tab.onClose!)}
      />
    </div>
  );
}

function CompactTabLabelButton({
  labelClassName,
  tab,
}: {
  labelClassName?: string;
  tab: CompactTabStripTab;
}) {
  const hasLeadingClose = Boolean(
    tab.onClose && tab.closePlacement === "leading-hover",
  );
  const button = (
    <button
      type="button"
      onClick={tab.onSelect}
      aria-label={tab.label}
      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
    >
      {tab.leadingIcon || hasLeadingClose ? (
        <span
          data-compact-tab-leading-slot=""
          className={cn(
            "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center",
            hasLeadingClose && "group-hover:opacity-0 group-focus-within:opacity-0",
          )}
        >
          {tab.leadingIcon}
        </span>
      ) : null}
      <span className={cn("min-w-0 truncate text-[12px] font-medium", labelClassName, tab.labelClassName)}>
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
  const item = (
    <div
      ref={itemRef}
      data-compact-tab-item=""
      onClick={(event) => event.target === event.currentTarget && tab.onSelect()}
      className={cn(
        tabBaseClassName ??
          "flex max-w-[180px] cursor-pointer items-center gap-1.5 border-r border-gray-200/70 border-b-2 px-2.5 py-2 transition-colors",
        "group relative",
        tab.active
          ? (activeTabClassName ?? "border-b-primary bg-white text-gray-900")
          : (inactiveTabClassName ??
            "border-b-transparent bg-gray-50/85 text-gray-500 hover:bg-gray-100"),
      )}
    >
      <CompactTabLabelButton tab={tab} labelClassName={labelClassName} />
      <CompactTabLeadingCloseOverlay tab={tab} />
      <CompactTabTrailingActions tab={tab} />
    </div>
  );

  return tab.menuGroups?.some((group) => group.items.length > 0) ? (
    <ContextMenu groups={tab.menuGroups} label={tab.menuLabel ?? tab.label}>
      {item}
    </ContextMenu>
  ) : item;
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
