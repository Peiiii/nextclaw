import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import {
  BookOpen,
  KeyRound,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useDocBrowser } from "@/shared/components/doc-browser";
import {
  getSidebarItemStackClass,
  SidebarActionItem,
  SidebarNavigationList,
  type SidebarNavListItem,
} from "@/app/components/layout/sidebar-items";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { useRemoteStatus } from "@/features/remote";
import { getSettingsNavSections } from "@/app/configs/app-navigation.config";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
import { useViewportLayoutStore } from "@/app/stores/viewport-layout.store";
import {
  SIDEBAR_RAIL_CONTROL_CLASS,
  SIDEBAR_RAIL_ICON_CLASS,
  SIDEBAR_RAIL_ITEM_GAP_CLASS,
  SIDEBAR_RAIL_PADDING_X_CLASS,
  SIDEBAR_RAIL_STACK_CLASS,
  SIDEBAR_RAIL_SURFACE_CLASS,
  SIDEBAR_RAIL_WIDTH_CLASS,
  SIDEBAR_SCROLL_EDGE_FADE_CLASS,
} from "@/app/components/layout/sidebar-rail.styles";

type SidebarNavSection = {
  label: string;
  items: SidebarNavListItem[];
};

function SidebarCollapseToggle({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  const label = isCollapsed ? t("sidebarExpand") : t("sidebarCollapse");
  const Icon = isCollapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <IconActionButton
      icon={<Icon className={SIDEBAR_RAIL_ICON_CLASS} />}
      label={label}
      className={cn(SIDEBAR_RAIL_SURFACE_CLASS, isCollapsed && SIDEBAR_RAIL_CONTROL_CLASS)}
      onClick={onToggle}
    />
  );
}

function SettingsSidebarHeader({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn("shrink-0", isCollapsed ? "px-0 py-1.5" : "px-2 py-2")}
    >
      <div
        className={cn(
          "flex items-center py-1",
          isCollapsed
            ? cn("flex-col px-0", SIDEBAR_RAIL_ITEM_GAP_CLASS)
            : "gap-2 px-1",
        )}
        data-testid="settings-sidebar-header"
      >
        {isCollapsed ? (
          <SidebarCollapseToggle
            isCollapsed={isCollapsed}
            onToggle={onToggle}
          />
        ) : null}
        <NavLink
          to="/chat"
          aria-label={t("backToMain")}
          className={cn(
            "group inline-flex min-w-0 items-center rounded-lg text-[12px] font-medium text-muted-foreground transition-colors hover:bg-gray-200/60 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
            isCollapsed
              ? cn(
                  SIDEBAR_RAIL_CONTROL_CLASS,
                  SIDEBAR_RAIL_SURFACE_CLASS,
                  "justify-center p-0",
                )
              : "gap-1.5 px-1 py-1",
          )}
        >
          <ArrowLeft
            className={cn(
              isCollapsed ? SIDEBAR_RAIL_ICON_CLASS : "h-3.5 w-3.5",
              "shrink-0 text-muted-foreground/75 group-hover:text-gray-700",
            )}
          />
          <span className={isCollapsed ? "sr-only" : "truncate"}>
            {t("backToMain")}
          </span>
        </NavLink>
        {!isCollapsed ? (
          <>
            <span
              className="h-4 w-px shrink-0 bg-border"
              aria-hidden="true"
            />
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">
              {t("settings")}
            </h1>
            <div className="ml-auto">
              <SidebarCollapseToggle
                isCollapsed={isCollapsed}
                onToggle={onToggle}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SidebarNavigation({
  isCollapsed,
  sections,
}: {
  isCollapsed: boolean;
  sections: SidebarNavSection[];
}) {
  return (
    <nav
      className={cn(
        "custom-scrollbar min-h-0 flex-1 overflow-y-auto",
        isCollapsed ? "pr-0" : "pr-1",
        SIDEBAR_SCROLL_EDGE_FADE_CLASS,
      )}
    >
      {!isCollapsed ? (
        <div className="space-y-3 pb-3">
          {sections.map((section) => (
            <section
              key={section.label}
              aria-label={section.label}
              className="space-y-1"
            >
              <h2 className="px-3 text-[11px] font-semibold text-muted-foreground/70">
                {section.label}
              </h2>
              <SidebarNavigationList
                isCollapsed={isCollapsed}
                items={section.items}
                density="compact"
              />
            </section>
          ))}
        </div>
      ) : (
        <SidebarNavigationList
          isCollapsed={isCollapsed}
          items={sections.flatMap((section) => section.items)}
          density="compact"
          className={cn(SIDEBAR_RAIL_STACK_CLASS, "pb-3")}
        />
      )}
    </nav>
  );
}

export function Sidebar() {
  const presenter = useAppPresenter();
  const docBrowser = useDocBrowser();
  const remoteStatus = useRemoteStatus();
  const isCollapsed = useViewportLayoutStore(
    (state) => state.isSidebarCollapsed,
  );
  const toggleCollapsed = viewportLayoutManager.toggleSidebarCollapsed;
  const accountEmail = remoteStatus.data?.account.email?.trim();
  const accountConnected = Boolean(remoteStatus.data?.account.loggedIn);
  const settingsNavSections = getSettingsNavSections(t);
  const sidebarStackClass = isCollapsed
    ? SIDEBAR_RAIL_STACK_CLASS
    : getSidebarItemStackClass("compact");

  return (
    <aside
      className={cn(
        "shrink-0 flex h-full min-h-0 flex-col overflow-hidden bg-secondary pb-6 transition-[width] duration-200 ease-out",
        isCollapsed
          ? cn(SIDEBAR_RAIL_WIDTH_CLASS, SIDEBAR_RAIL_PADDING_X_CLASS)
          : "w-[240px] px-4",
      )}
      data-sidebar-collapsed={isCollapsed ? "true" : "false"}
    >
      <SettingsSidebarHeader
        isCollapsed={isCollapsed}
        onToggle={toggleCollapsed}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <SidebarNavigation
          isCollapsed={isCollapsed}
          sections={settingsNavSections}
        />

        <div
          className={cn(
            "shrink-0 bg-secondary",
            isCollapsed
              ? "mt-2 flex flex-col items-center pt-2"
              : "mt-2 pt-3",
            sidebarStackClass,
          )}
        >
          <SidebarActionItem
            onClick={() =>
              docBrowser.open(undefined, {
                kind: "docs",
                title: t("docBrowserHelp"),
              })
            }
            icon={BookOpen}
            label={t("docBrowserHelp")}
            density="compact"
            collapsed={isCollapsed}
          />
          <SidebarActionItem
            onClick={() => presenter.accountManager.openAccountPanel()}
            icon={KeyRound}
            label={t("remoteAccountEntryManage")}
            density="compact"
            trailing={
              accountConnected
                ? accountEmail || t("remoteAccountEntryConnected")
                : t("remoteAccountEntryDisconnected")
            }
            trailingClassName="max-w-[92px] truncate text-right"
            testId="settings-sidebar-account-entry"
            trailingTestId="settings-sidebar-account-status"
            collapsed={isCollapsed}
          />
        </div>
      </div>
    </aside>
  );
}
