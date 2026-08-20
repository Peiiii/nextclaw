import { useMemo, useState } from "react";
import { MoreVertical } from "lucide-react";
import { SidebarNavLinkItem } from "@/app/components/layout/sidebar-items";
import { SIDEBAR_RAIL_STACK_CLASS } from "@/app/components/layout/sidebar-rail.styles";
import { PanelAppIcon } from "@/features/panel-apps/components/panel-app-icon";
import { PanelAppMainSidebarMenuItem } from "@/features/panel-apps/components/panel-app-main-sidebar-menu-item";
import { usePanelApps } from "@/features/panel-apps/hooks/use-panel-apps";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import type { PanelAppEntryView } from "@/shared/lib/api";
import { t } from "@/shared/lib/i18n";
import { cn } from "@/shared/lib/utils";

const MAIN_SIDEBAR_FALLBACK_ORDER = Number.MAX_SAFE_INTEGER;

export function getMainSidebarPanelApps(
  entries: readonly PanelAppEntryView[],
): PanelAppEntryView[] {
  return entries
    .filter((entry) => entry.mainSidebar)
    .sort((left, right) =>
      (left.mainSidebarOrder ?? MAIN_SIDEBAR_FALLBACK_ORDER) -
        (right.mainSidebarOrder ?? MAIN_SIDEBAR_FALLBACK_ORDER) ||
      left.title.localeCompare(right.title)
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

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-1 border-t border-border/50 pt-1",
        isCollapsed ? "px-0" : "px-3",
      )}
      data-testid="panel-app-main-sidebar-nav"
    >
      <ul className={isCollapsed ? SIDEBAR_RAIL_STACK_CLASS : "space-y-0.5"}>
        {entries.map((entry) => (
          <PanelAppMainSidebarNavItem
            key={entry.appId}
            entry={entry}
            isCollapsed={isCollapsed}
          />
        ))}
      </ul>
    </div>
  );
}

function PanelAppMainSidebarNavItem({
  entry,
  isCollapsed,
}: {
  entry: PanelAppEntryView;
  isCollapsed: boolean;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const link = (
    <SidebarNavLinkItem
      to={`/apps/panel/${encodeURIComponent(entry.appId)}`}
      label={entry.title}
      iconNode={(
        <PanelAppIcon
          icon={entry.icon}
          title={entry.title}
          className="h-full w-full text-[13px]"
          imageClassName="rounded-[3px]"
        />
      )}
      density="compact"
      collapsed={isCollapsed}
      className={isCollapsed ? undefined : "rounded-lg py-1.5 pl-2.5 pr-9"}
    />
  );

  if (isCollapsed) {
    return <li className="flex justify-center">{link}</li>;
  }

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
