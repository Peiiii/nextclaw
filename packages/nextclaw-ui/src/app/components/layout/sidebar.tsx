import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import { THEME_OPTIONS, type UiTheme } from "@/shared/lib/theme";
import {
  BookOpen,
  Languages,
  Palette,
  KeyRound,
  Settings,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { BrandHeader } from "@/shared/components/common/brand-header";
import {
  SidebarActionItem,
  SidebarNavigationList,
  SidebarNavLinkItem,
  SidebarSelectItem,
  type SidebarItemDensity,
  type SidebarNavListItem,
} from "@/app/components/layout/sidebar-items";
import { useTheme } from "@/app/components/theme-provider";
import { SelectItem } from "@/shared/components/ui/select";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { useRemoteStatus } from "@/features/remote";
import {
  getMainSidebarNavItems,
  getSettingsNavSections,
} from "@/app/configs/app-navigation.config";
import { useLanguagePreference } from "@/features/settings";
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

type SidebarMode = "main" | "settings";

type SidebarProps = {
  mode: SidebarMode;
};

type SidebarNavSection = {
  label: string;
  items: SidebarNavListItem[];
};

type SidebarNavigationModel = {
  items: SidebarNavListItem[];
  sections?: SidebarNavSection[];
  density: SidebarItemDensity;
};

type SidebarTranslate = (key: string) => string;

function resolveSidebarNavigation(
  isSettingsMode: boolean,
  translate: SidebarTranslate,
): SidebarNavigationModel {
  if (!isSettingsMode) {
    return {
      items: getMainSidebarNavItems(translate),
      density: "default",
    };
  }

  const sections = getSettingsNavSections(translate);
  return {
    items: sections.flatMap((section) => section.items),
    sections,
    density: "compact",
  };
}

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

function MainSidebarHeader({
  isCollapsed,
  onToggle,
}: {
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "shrink-0",
        isCollapsed ? "flex justify-center px-0 py-1.5" : "px-2 py-2",
      )}
    >
      {isCollapsed ? (
        <SidebarCollapseToggle isCollapsed={isCollapsed} onToggle={onToggle} />
      ) : (
        <div className="flex items-center gap-2">
          <BrandHeader className="flex min-w-0 flex-1 items-center gap-2.5 cursor-pointer" />
          <SidebarCollapseToggle
            isCollapsed={isCollapsed}
            onToggle={onToggle}
          />
        </div>
      )}
    </div>
  );
}

function SidebarHeader({
  isSettingsMode,
  isCollapsed,
  onToggle,
}: {
  isSettingsMode: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
}) {
  return isSettingsMode ? (
    <SettingsSidebarHeader isCollapsed={isCollapsed} onToggle={onToggle} />
  ) : (
    <MainSidebarHeader isCollapsed={isCollapsed} onToggle={onToggle} />
  );
}

function SidebarNavigation({
  isSettingsMode,
  isCollapsed,
  items,
  sections,
  density,
}: {
  isSettingsMode: boolean;
  isCollapsed: boolean;
  items: SidebarNavListItem[];
  sections?: SidebarNavSection[];
  density: SidebarItemDensity;
}) {
  const listClassName = cn(
    isCollapsed
      ? cn(SIDEBAR_RAIL_STACK_CLASS, "pb-3")
      : isSettingsMode
        ? "space-y-0.5 pb-3"
        : "space-y-1 pb-4",
  );

  return (
    <nav
      className={cn(
        "custom-scrollbar min-h-0 flex-1 overflow-y-auto",
        isCollapsed ? "pr-0" : "pr-1",
        SIDEBAR_SCROLL_EDGE_FADE_CLASS,
      )}
    >
      {sections && !isCollapsed ? (
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
                density={density}
                className="space-y-0.5"
              />
            </section>
          ))}
        </div>
      ) : (
        <SidebarNavigationList
          isCollapsed={isCollapsed}
          items={items}
          density={density}
          className={listClassName}
        />
      )}
    </nav>
  );
}

export function Sidebar({ mode }: SidebarProps) {
  const presenter = useAppPresenter();
  const docBrowser = useDocBrowser();
  const remoteStatus = useRemoteStatus();
  const isCollapsed = useViewportLayoutStore(
    (state) => state.isSidebarCollapsed,
  );
  const toggleCollapsed = viewportLayoutManager.toggleSidebarCollapsed;
  const {
    currentLanguage,
    currentLanguageLabel,
    languageOptions,
    selectLanguage,
  } = useLanguagePreference();
  const { theme, setTheme } = useTheme();
  const isSettingsMode = mode === "settings";
  const currentThemeLabel = t(
    THEME_OPTIONS.find((option) => option.value === theme)?.labelKey ??
      "themeWork",
  );
  const accountEmail = remoteStatus.data?.account.email?.trim();
  const accountConnected = Boolean(remoteStatus.data?.account.loggedIn);

  const handleThemeSwitch = (nextTheme: UiTheme) => {
    if (theme !== nextTheme) setTheme(nextTheme);
  };

  const {
    items: navItems,
    sections: settingsNavSections,
    density: sidebarDensity,
  } = resolveSidebarNavigation(isSettingsMode, t);

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
      <SidebarHeader
        isSettingsMode={isSettingsMode}
        isCollapsed={isCollapsed}
        onToggle={toggleCollapsed}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <SidebarNavigation
          isSettingsMode={isSettingsMode}
          isCollapsed={isCollapsed}
          items={navItems}
          sections={settingsNavSections}
          density={sidebarDensity}
        />

        <div
          className={cn(
            "shrink-0 bg-secondary",
            isCollapsed
              ? "mt-2 pt-2"
              : isSettingsMode
                ? "mt-2 pt-3"
                : "mt-3 pt-3",
          )}
        >
          {isSettingsMode ? (
            <SidebarActionItem
              onClick={() => presenter.accountManager.openAccountPanel()}
              icon={KeyRound}
              label={t("remoteAccountEntryManage")}
              density="compact"
              className={isCollapsed ? "mb-1" : "mb-1.5"}
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
          ) : null}
          {mode === "main" && (
            <div
              className={cn(
                isCollapsed ? "mb-1" : "mb-2",
                isCollapsed ? "flex justify-center" : undefined,
              )}
            >
              <SidebarNavLinkItem
                to="/settings"
                label={t("settings")}
                icon={Settings}
                collapsed={isCollapsed}
              />
            </div>
          )}
          <div
            className={cn(
              isCollapsed ? "mb-1" : "mb-2",
              isCollapsed ? "flex justify-center" : undefined,
            )}
          >
            <SidebarSelectItem
              value={theme}
              onValueChange={(value) => handleThemeSwitch(value as UiTheme)}
              icon={Palette}
              label={t("theme")}
              valueLabel={currentThemeLabel}
              density={sidebarDensity}
              collapsed={isCollapsed}
            >
              {THEME_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-xs"
                >
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SidebarSelectItem>
          </div>
          <div
            className={cn(
              isCollapsed ? "mb-1" : "mb-2",
              isCollapsed ? "flex justify-center" : undefined,
            )}
          >
            <SidebarSelectItem
              value={currentLanguage}
              onValueChange={(value) =>
                selectLanguage(value as typeof currentLanguage)
              }
              icon={Languages}
              label={t("language")}
              valueLabel={currentLanguageLabel}
              density={sidebarDensity}
              collapsed={isCollapsed}
            >
              {languageOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-xs"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SidebarSelectItem>
          </div>
          <SidebarActionItem
            onClick={() =>
              docBrowser.open(undefined, {
                kind: "docs",
                title: t("docBrowserHelp"),
              })
            }
            icon={BookOpen}
            label={t("docBrowserHelp")}
            density={sidebarDensity}
            collapsed={isCollapsed}
          />
        </div>
      </div>
    </aside>
  );
}
