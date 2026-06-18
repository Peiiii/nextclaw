import { cn } from "@/shared/lib/utils";
import { t } from "@/shared/lib/i18n";
import { THEME_OPTIONS, type UiTheme } from "@/shared/lib/theme";
import {
  MessageCircle,
  BookOpen,
  BrainCircuit,
  AlarmClock,
  Languages,
  Palette,
  KeyRound,
  Settings,
  ArrowLeft,
  Bot,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { BrandHeader } from "@/shared/components/common/brand-header";
import {
  SidebarActionItem,
  SidebarNavLinkItem,
  SidebarSelectItem,
} from "@/app/components/layout/sidebar-items";
import { useTheme } from "@/app/components/theme-provider";
import { SelectItem } from "@/shared/components/ui/select";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import { useAppPresenter } from "@/app/components/app-presenter-provider";
import { useRemoteStatus } from "@/features/remote";
import { getSettingsNavItems } from "@/app/configs/app-navigation.config";
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
} from "@/app/components/layout/sidebar-rail.styles";

type SidebarMode = "main" | "settings";

type SidebarProps = {
  mode: SidebarMode;
};

type SidebarNavItem = {
  target: string;
  label: string;
  icon: LucideIcon;
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
            "group inline-flex min-w-0 items-center rounded-lg text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35",
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
              "shrink-0 text-gray-500 group-hover:text-gray-800",
            )}
          />
          <span className={isCollapsed ? "sr-only" : "truncate"}>
            {t("backToMain")}
          </span>
        </NavLink>
        {!isCollapsed ? (
          <>
            <span
              className="h-4 w-px shrink-0 bg-[#dddfe6]"
              aria-hidden="true"
            />
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-gray-800">
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
  density,
}: {
  isSettingsMode: boolean;
  isCollapsed: boolean;
  items: SidebarNavItem[];
  density: "default" | "compact";
}) {
  return (
    <nav
      className={cn(
        "custom-scrollbar min-h-0 flex-1 overflow-y-auto",
        isCollapsed ? "pr-0" : "pr-1",
      )}
    >
      <ul
        className={cn(
          isCollapsed
            ? cn(SIDEBAR_RAIL_STACK_CLASS, "pb-3")
            : isSettingsMode
              ? "space-y-0.5 pb-3"
              : "space-y-1 pb-4",
        )}
      >
        {items.map((item) => {
          return (
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
          );
        })}
      </ul>
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
      "themeWarm",
  );
  const accountEmail = remoteStatus.data?.account.email?.trim();
  const accountConnected = Boolean(remoteStatus.data?.account.loggedIn);

  const handleThemeSwitch = (nextTheme: UiTheme) => {
    if (theme === nextTheme) {
      return;
    }
    setTheme(nextTheme);
  };

  // Core navigation items - primary features
  const mainNavItems: SidebarNavItem[] = [
    {
      target: "/chat",
      label: t("chat"),
      icon: MessageCircle,
    },
    {
      target: "/chat/cron",
      label: t("cron"),
      icon: AlarmClock,
    },
    {
      target: "/chat/skills",
      label: t("marketplaceFilterSkills"),
      icon: BrainCircuit,
    },
    {
      target: "/agents",
      label: t("agentsPageTitle"),
      icon: Bot,
    },
  ];

  const settingsNavItems = getSettingsNavItems(t);
  const navItems = isSettingsMode ? settingsNavItems : mainNavItems;
  const sidebarDensity = isSettingsMode ? "compact" : "default";

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
        {/* Navigation */}
        <SidebarNavigation
          isSettingsMode={isSettingsMode}
          isCollapsed={isCollapsed}
          items={navItems}
          density={sidebarDensity}
        />

        {/* Footer actions stay reachable while the nav scrolls independently. */}
        <div
          className={cn(
            "shrink-0 border-t border-[#dde0ea] bg-secondary",
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
