import { useState } from "react";
import { ChevronDown, PanelsTopLeft } from "lucide-react";
import { SidebarNavLinkItem } from "@/app/components/layout/sidebar-items";
import { SIDEBAR_RAIL_CONTROL_CLASS, SIDEBAR_RAIL_SURFACE_CLASS } from "@/app/components/layout/sidebar-rail.styles";
import { usePanelApps } from "@/features/panel-apps";
import { createPanelAppRightPanelResourceTarget } from "@/features/right-panel-resources/utils/right-panel-resource-uri.utils";
import {
  pageResourceFromTarget,
  pageResourceMainPath,
} from "@/features/right-panel-resources/utils/page-resource-identity.utils";
import { usePageNavigationStore } from "@/features/right-panel-resources/stores/page-navigation.store";
import { PageResourceActionsMenu } from "./page-resource-actions-menu";
import { PageResourceIcon } from "./page-resource-icon";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
import { useViewportLayoutStore } from "@/app/stores/viewport-layout.store";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";
import type { PageResource } from "@/features/right-panel-resources/types/page-resource.types";
import { t } from "@/shared/lib/i18n";

function PageResourceSidebarItems({
  pages,
  onNavigate,
}: {
  pages: PageResource[];
  onNavigate?: () => void;
}) {
  const app = useAppPresenter();
  return (
    <ul className="space-y-0.5">
      {pages.map((page) => (
        <li
          key={page.uri}
        >
          <SidebarNavLinkItem
            to={pageResourceMainPath(page)}
            label={page.title}
            density="compact"
            iconNode={<PageResourceIcon uri={page.uri} icon={page.target.dockIcon} />}
            actions={<PageResourceActionsMenu page={page} revealOnHover />}
            onNavigate={() => {
              app.pageResourceManager.remember(page);
              onNavigate?.();
            }}
          />
        </li>
      ))}
    </ul>
  );
}

export function PageResourceSidebarNav({
  isCollapsed,
}: {
  isCollapsed: boolean;
}) {
  const apps = usePanelApps();
  const pinned = usePageNavigationStore((state) => state.pinned);
  const groupCollapsed = useViewportLayoutStore(
    (state) => state.isMainSidebarAppGroupCollapsed,
  );
  const [railOpen, setRailOpen] = useState(false);
  const appPages = (apps.data?.entries ?? [])
    .filter((entry) => entry.mainSidebar)
    .sort((a, b) => (a.mainSidebarOrder ?? 0) - (b.mainSidebarOrder ?? 0))
    .map((entry) =>
      pageResourceFromTarget(createPanelAppRightPanelResourceTarget(entry)),
    );
  const pages = [
    ...appPages,
    ...pinned.filter((page) => !appPages.some((app) => app.uri === page.uri)),
  ];
  if (!pages.length) return null;
  if (isCollapsed)
    return (
      <Popover open={railOpen} onOpenChange={setRailOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("pageSidebar")}
            className={`mx-auto my-1 flex items-center justify-center ${SIDEBAR_RAIL_CONTROL_CLASS} ${SIDEBAR_RAIL_SURFACE_CLASS}`}
          >
            <PanelsTopLeft className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" className="w-64 p-2">
          <PageResourceSidebarItems
            pages={pages}
            onNavigate={() => setRailOpen(false)}
          />
        </PopoverContent>
      </Popover>
    );
  return (
    <nav
      aria-label={t("pageSidebar")}
      className="mt-1 border-t border-border/50 px-3 pt-1"
      data-testid="page-resource-sidebar-nav"
    >
      <button
        type="button"
        aria-expanded={!groupCollapsed}
        onClick={viewportLayoutManager.toggleMainSidebarAppGroupCollapsed}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-[13px] text-muted-foreground"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 ${groupCollapsed ? "-rotate-90" : ""}`}
        />
        <span className="flex-1 text-left">{t("pageSidebar")}</span>
        <span>{pages.length}</span>
      </button>
      {!groupCollapsed && <PageResourceSidebarItems pages={pages} />}
    </nav>
  );
}
