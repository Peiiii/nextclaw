import type { ComponentType, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectTrigger,
} from "@/shared/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";
import {
  SIDEBAR_RAIL_ACTIVE_SURFACE_CLASS,
  SIDEBAR_RAIL_CONTROL_CLASS,
  SIDEBAR_RAIL_ICON_CLASS,
  SIDEBAR_RAIL_SURFACE_CLASS,
} from "@/app/components/layout/sidebar-rail.styles";

export type SidebarIcon = ComponentType<{ className?: string }>;
export type SidebarItemDensity = "default" | "compact";

export type SidebarNavListItem = {
  target: string;
  label: string;
  icon: SidebarIcon;
};

type SidebarItemTone = {
  row: string;
  icon: string;
  value: string;
  gap: string;
};

const SIDEBAR_ITEM_TONES: Record<SidebarItemDensity, SidebarItemTone> = {
  default: {
    row: "gap-3 px-3 py-2.5 text-[14px]",
    icon: "h-[17px] w-[17px]",
    value: "text-xs",
    gap: "gap-3",
  },
  compact: {
    row: "gap-2.5 px-3 py-2 text-[13px]",
    icon: "h-4 w-4",
    value: "text-[11px]",
    gap: "gap-2.5",
  },
};

function getSidebarItemTone(density: SidebarItemDensity): SidebarItemTone {
  return SIDEBAR_ITEM_TONES[density];
}

function isSidebarRouteActive(pathname: string, target: string): boolean {
  const normalizedPathname = pathname.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  return (
    normalizedPathname === normalizedTarget ||
    normalizedPathname.startsWith(`${normalizedTarget}/`)
  );
}

function SidebarItemTooltip({
  children,
  label,
  side = "right",
}: {
  children: ReactNode;
  label: ReactNode;
  side?: "right" | "bottom";
}) {
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type SidebarNavLinkItemProps = {
  to: string;
  label: string;
  icon: SidebarIcon;
  density?: SidebarItemDensity;
  className?: string;
  collapsed?: boolean;
};

export function SidebarNavLinkItem({
  to,
  label,
  icon: Icon,
  density = "default",
  className,
  collapsed = false,
}: SidebarNavLinkItemProps) {
  const tone = getSidebarItemTone(density);
  const { pathname } = useLocation();
  const isActive = isSidebarRouteActive(pathname, to);
  const link = (
    <Link
      to={to}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group flex w-full items-center rounded-xl font-medium transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
        collapsed
          ? cn(SIDEBAR_RAIL_CONTROL_CLASS, "justify-center px-0 py-0")
          : tone.row,
        isActive
          ? collapsed
            ? SIDEBAR_RAIL_ACTIVE_SURFACE_CLASS
            : "bg-gray-200/80 text-gray-900 shadow-sm"
          : collapsed
            ? SIDEBAR_RAIL_SURFACE_CLASS
            : "text-muted-foreground hover:bg-gray-200/60 hover:text-gray-900",
        className,
      )}
    >
      <Icon
        className={cn(
          collapsed ? SIDEBAR_RAIL_ICON_CLASS : tone.icon,
          "shrink-0 transition-colors",
          isActive
            ? "text-gray-700"
            : "text-muted-foreground/75 group-hover:text-gray-700",
        )}
      />
      <span className={collapsed ? "sr-only" : "min-w-0 flex-1 text-left"}>
        {label}
      </span>
    </Link>
  );

  return collapsed ? (
    <SidebarItemTooltip label={label}>{link}</SidebarItemTooltip>
  ) : (
    link
  );
}

type SidebarNavigationListProps = {
  isCollapsed: boolean;
  items: SidebarNavListItem[];
  density: SidebarItemDensity;
  className: string;
};

export function SidebarNavigationList({
  isCollapsed,
  items,
  density,
  className,
}: SidebarNavigationListProps) {
  return (
    <ul className={className}>
      {items.map((item) => (
        <li
          key={item.target}
          className={isCollapsed ? "flex justify-center" : undefined}
        >
          <SidebarNavLinkItem
            to={item.target}
            label={item.label}
            icon={item.icon}
            density={density}
            collapsed={isCollapsed}
          />
        </li>
      ))}
    </ul>
  );
}

type SidebarActionItemProps = {
  label: string;
  icon: SidebarIcon;
  onClick: () => void;
  density?: SidebarItemDensity;
  className?: string;
  labelClassName?: string;
  trailing?: ReactNode;
  trailingClassName?: string;
  testId?: string;
  trailingTestId?: string;
  collapsed?: boolean;
};

export function SidebarActionItem({
  label,
  icon: Icon,
  onClick,
  density = "default",
  className,
  labelClassName,
  trailing,
  trailingClassName,
  testId,
  trailingTestId,
  collapsed = false,
}: SidebarActionItemProps) {
  const tone = getSidebarItemTone(density);
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "group flex w-full items-center rounded-xl font-medium text-muted-foreground transition-colors duration-base hover:bg-gray-200/60 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
        collapsed
          ? cn(
              SIDEBAR_RAIL_CONTROL_CLASS,
              "justify-center px-0 py-0",
              SIDEBAR_RAIL_SURFACE_CLASS,
            )
          : tone.row,
        className,
      )}
      data-testid={testId}
    >
      <Icon
        className={cn(
          collapsed ? SIDEBAR_RAIL_ICON_CLASS : tone.icon,
          "shrink-0 text-muted-foreground/75 transition-colors group-hover:text-gray-700",
        )}
      />
      <span
        className={cn(
          collapsed ? "sr-only" : "min-w-0 flex-1 text-left",
          labelClassName,
        )}
      >
        {label}
      </span>
      {!collapsed && trailing ? (
        <span
          className={cn(
            "shrink-0 text-muted-foreground",
            tone.value,
            trailingClassName,
          )}
          data-testid={trailingTestId}
        >
          {trailing}
        </span>
      ) : null}
    </button>
  );

  return collapsed ? (
    <SidebarItemTooltip label={label}>{button}</SidebarItemTooltip>
  ) : (
    button
  );
}

type SidebarSelectItemProps = {
  label: string;
  icon: SidebarIcon;
  value: string;
  valueLabel: string;
  onValueChange: (value: string) => void;
  density?: SidebarItemDensity;
  children: ReactNode;
  collapsed?: boolean;
};

export function SidebarSelectItem({
  label,
  icon: Icon,
  value,
  valueLabel,
  onValueChange,
  density = "default",
  children,
  collapsed = false,
}: SidebarSelectItemProps) {
  const tone = getSidebarItemTone(density);
  const trigger = (
    <SelectTrigger
      aria-label={label}
      className={cn(
        "group h-auto w-full rounded-xl border-0 bg-transparent font-medium text-muted-foreground shadow-none hover:bg-gray-200/60 hover:text-gray-900 focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary/35",
        collapsed
          ? cn(
              SIDEBAR_RAIL_CONTROL_CLASS,
              "justify-center px-0 py-0",
              SIDEBAR_RAIL_SURFACE_CLASS,
            )
          : tone.row,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center",
          collapsed ? "justify-center" : tone.gap,
        )}
      >
        <Icon
          className={cn(
            collapsed ? SIDEBAR_RAIL_ICON_CLASS : tone.icon,
            "shrink-0 text-muted-foreground/75 transition-colors group-hover:text-gray-700",
          )}
        />
        <span className={collapsed ? "sr-only" : "text-left"}>{label}</span>
      </div>
      {!collapsed ? (
        <span className={cn("ml-auto text-muted-foreground", tone.value)}>
          {valueLabel}
        </span>
      ) : null}
    </SelectTrigger>
  );

  return (
    <Select value={value} onValueChange={onValueChange}>
      {collapsed ? (
        <SidebarItemTooltip label={`${label}: ${valueLabel}`}>
          {trigger}
        </SidebarItemTooltip>
      ) : (
        trigger
      )}
      <SelectContent>{children}</SelectContent>
    </Select>
  );
}
