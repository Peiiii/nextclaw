import { useMemo, useState } from "react";
import { ChevronDown, LayoutGrid, MoreVertical } from "lucide-react";
import { useLocation } from "react-router-dom";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
import {
  SIDEBAR_RAIL_ACTIVE_SURFACE_CLASS,
  SIDEBAR_RAIL_CONTROL_CLASS,
  SIDEBAR_RAIL_ICON_CLASS,
  SIDEBAR_RAIL_SURFACE_CLASS,
} from "@/app/components/layout/sidebar-rail.styles";
import { SidebarNavLinkItem } from "@/app/components/layout/sidebar-items";
import { useViewportLayoutStore } from "@/app/stores/viewport-layout.store";
import { PanelAppIcon } from "@/features/panel-apps/components/panel-app-icon";
import { PanelAppMainSidebarMenuItem } from "@/features/panel-apps/components/panel-app-main-sidebar-menu-item";
import { usePanelApps } from "@/features/panel-apps/hooks/use-panel-apps";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { PanelAppEntryView } from "@/shared/lib/api";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

const MAIN_SIDEBAR_FALLBACK_ORDER = Number.MAX_SAFE_INTEGER;

export function getMainSidebarPanelApps(
  entries: readonly PanelAppEntryView[],
): PanelAppEntryView[] {
  return entries
    .filter((entry) => entry.mainSidebar)
    .sort(
      (left, right) =>
        (left.mainSidebarOrder ?? MAIN_SIDEBAR_FALLBACK_ORDER) -
          (right.mainSidebarOrder ?? MAIN_SIDEBAR_FALLBACK_ORDER) ||
        left.title.localeCompare(right.title),
    );
}

export function PanelAppMainSidebarNav({
  isCollapsed,
}: {
  isCollapsed: boolean;
}) {
  const panelApps = usePanelApps();
  const entries = useMemo(
    () => getMainSidebarPanelApps(panelApps.data?.entries ?? []),
    [panelApps.data?.entries],
  );
  const isGroupCollapsed = useViewportLayoutStore(
    (state) => state.isMainSidebarAppGroupCollapsed,
  );

  if (entries.length === 0) {
    return null;
  }

  if (isCollapsed) {
    return <PanelAppMainSidebarRailMenu entries={entries} />;
  }

  return (
    <div
      className="mt-1 border-t border-border/50 px-3 pt-1"
      data-testid="panel-app-main-sidebar-nav"
    >
      <PanelAppMainSidebarGroupHeader
        entries={entries}
        isCollapsed={isGroupCollapsed}
      />
      {!isGroupCollapsed ? (
        <ul className="mt-0.5 space-y-0.5">
          {entries.map((entry) => (
            <PanelAppMainSidebarNavItem key={entry.appId} entry={entry} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function getPanelAppTarget(appId: string): string {
  return `/apps/panel/${encodeURIComponent(appId)}`;
}

function useHasActivePanelApp(entries: readonly PanelAppEntryView[]): boolean {
  const { pathname } = useLocation();
  return entries.some((entry) => pathname === getPanelAppTarget(entry.appId));
}

function PanelAppMainSidebarGroupHeader({
  entries,
  isCollapsed,
}: {
  entries: readonly PanelAppEntryView[];
  isCollapsed: boolean;
}) {
  const isActive = useHasActivePanelApp(entries);
  const actionLabel = isCollapsed
    ? t("panelAppsMainSidebarGroupExpand")
    : t("panelAppsMainSidebarGroupCollapse");
  return (
    <button
      type="button"
      aria-label={actionLabel}
      aria-expanded={!isCollapsed}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-gray-200/60 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
        isCollapsed && isActive && "bg-gray-200/80 text-gray-900",
      )}
      onClick={viewportLayoutManager.toggleMainSidebarAppGroupCollapsed}
    >
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-transform",
          isCollapsed && "-rotate-90",
        )}
      />
      <span className="min-w-0 flex-1 truncate">
        {t("panelAppsMainSidebarGroup")}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground">
        {entries.length}
      </span>
    </button>
  );
}

function PanelAppMainSidebarRailMenu({
  entries,
}: {
  entries: PanelAppEntryView[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = useHasActivePanelApp(entries);
  const label = t("panelAppsMainSidebarGroup");
  return (
    <div
      className="mt-1 flex justify-center border-t border-border/50 pt-1"
      data-testid="panel-app-main-sidebar-nav"
    >
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <TooltipProvider delayDuration={250}>
          <Tooltip disableHoverableContent>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <IconActionButton
                  icon={<LayoutGrid className={SIDEBAR_RAIL_ICON_CLASS} />}
                  label={label}
                  tooltip={false}
                  className={cn(
                    SIDEBAR_RAIL_CONTROL_CLASS,
                    isActive
                      ? SIDEBAR_RAIL_ACTIVE_SURFACE_CLASS
                      : SIDEBAR_RAIL_SURFACE_CLASS,
                  )}
                />
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent
          side="right"
          align="start"
          className="w-60 rounded-xl p-2"
        >
          <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-muted-foreground">
            <span>{label}</span>
            <span className="font-medium text-muted-foreground/60">
              {entries.length}
            </span>
          </div>
          <ul className="mt-1 space-y-0.5">
            {entries.map((entry) => (
              <PanelAppMainSidebarNavItem
                key={entry.appId}
                entry={entry}
                onNavigate={() => setIsOpen(false)}
              />
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function PanelAppMainSidebarNavItem({
  entry,
  onNavigate,
}: {
  entry: PanelAppEntryView;
  onNavigate?: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const linkItem = (
    <SidebarNavLinkItem
      to={getPanelAppTarget(entry.appId)}
      label={entry.title}
      iconNode={
        <PanelAppIcon
          icon={entry.icon}
          title={entry.title}
          className="h-full w-full text-[13px]"
          imageClassName="rounded-[3px]"
        />
      }
      density="compact"
      className="rounded-lg py-1.5 pl-5 pr-9"
    />
  );
  const link = onNavigate ? (
    <div onClick={onNavigate}>{linkItem}</div>
  ) : (
    linkItem
  );
  const menuLabel = `${t("panelAppsMoreActions")}: ${entry.title}`;
  return (
    <li>
      <div className="group/panel-app relative">
        {link}
        <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={menuLabel}
              className={cn(
                "absolute right-1 top-1/2 z-[1] -translate-y-1/2 rounded-md p-1 text-muted-foreground/70 transition-[color,background-color,opacity] hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
                isMenuOpen
                  ? "pointer-events-auto opacity-100"
                  : "pointer-events-none opacity-0 group-hover/panel-app:pointer-events-auto group-hover/panel-app:opacity-100 group-focus-within/panel-app:pointer-events-auto group-focus-within/panel-app:opacity-100",
              )}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-48 rounded-xl p-1.5">
            <PanelAppMainSidebarMenuItem
              entry={entry}
              onSelect={() => setIsMenuOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
    </li>
  );
}
