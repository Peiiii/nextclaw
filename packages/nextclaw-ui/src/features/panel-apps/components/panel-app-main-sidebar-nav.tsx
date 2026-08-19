import { useMemo } from "react";
import { SidebarNavLinkItem } from "@/app/components/layout/sidebar-items";
import { SIDEBAR_RAIL_STACK_CLASS } from "@/app/components/layout/sidebar-rail.styles";
import { PanelAppIcon } from "@/features/panel-apps/components/panel-app-icon";
import { usePanelApps } from "@/features/panel-apps/hooks/use-panel-apps";
import type { PanelAppEntryView } from "@/shared/lib/api";
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
          <li
            key={entry.appId}
            className={isCollapsed ? "flex justify-center" : undefined}
          >
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
              className={isCollapsed ? undefined : "rounded-lg px-2.5 py-1.5"}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
