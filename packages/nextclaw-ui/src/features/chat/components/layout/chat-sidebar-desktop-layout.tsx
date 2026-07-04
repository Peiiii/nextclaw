import { BrandHeader } from "@/shared/components/common/brand-header";
import { StatusBadge } from "@/shared/components/common/status-badge";
import { ChatSidebarListModeSwitch } from "@/features/chat/components/chat-sidebar-list-mode-switch";
import type {
  groupSessionsByDate,
  groupSessionsByProject,
} from "@/features/chat/features/session/utils/chat-sidebar-session-groups.utils";
import type { NcpSessionListItemView } from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import type { useSystemStatus } from "@/features/system-status";
import { cn } from "@/shared/lib/utils";
import { t, type I18nLanguage } from "@/shared/lib/i18n";
import type { UiTheme } from "@/shared/lib/theme";
import { SidebarNavLinkItem } from "@/app/components/layout/sidebar-items";
import { IconActionButton } from "@/shared/components/ui/actions/icon-action-button";
import {
  AlarmClock,
  Bot,
  BrainCircuit,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { ChatSidebarSessionList } from "@/features/chat/features/session/components/chat-sidebar-session-list";
import { ChatSidebarUtilityMenu } from "@/features/chat/components/layout/chat-sidebar-utility-menu";
import { isWindowsDesktopHost } from "@/platforms/desktop";
import { viewportLayoutManager } from "@/app/managers/viewport-layout.manager";
import {
  SIDEBAR_RAIL_CONTROL_CLASS,
  SIDEBAR_RAIL_ICON_CLASS,
  SIDEBAR_RAIL_PADDING_X_CLASS,
  SIDEBAR_RAIL_STACK_CLASS,
  SIDEBAR_RAIL_SURFACE_CLASS,
  SIDEBAR_SCROLL_EDGE_FADE_CLASS,
} from "@/app/components/layout/sidebar-rail.styles";

const navItems = [
  {
    target: "/cron",
    label: () => t("chatSidebarScheduledTasks"),
    icon: AlarmClock,
  },
  {
    target: "/skills",
    label: () => t("chatSidebarSkills"),
    icon: BrainCircuit,
  },
  { target: "/agents", label: () => t("agentsPageTitle"), icon: Bot },
];

function ChatSidebarCollapseButton({ isCollapsed }: { isCollapsed: boolean }) {
  const label = isCollapsed ? t("sidebarExpand") : t("sidebarCollapse");
  const Icon = isCollapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <IconActionButton
      icon={<Icon className={SIDEBAR_RAIL_ICON_CLASS} />}
      label={label}
      className={cn(SIDEBAR_RAIL_SURFACE_CLASS, isCollapsed && SIDEBAR_RAIL_CONTROL_CLASS)}
      onClick={viewportLayoutManager.toggleSidebarCollapsed}
    />
  );
}

export function ChatSidebarDesktopHeader({
  connectionStatus,
  isCollapsed,
}: {
  connectionStatus: ReturnType<typeof useSystemStatus>["connectionStatus"];
  isCollapsed: boolean;
}) {
  const isWindowsHost = isWindowsDesktopHost();
  const shouldReserveMacWindowControls = typeof window !== "undefined" && window.nextclawDesktop?.platform === "darwin";

  return (
    <div
      className={cn(
        "flex items-center",
        isCollapsed
          ? "justify-center px-2 py-1.5"
          : isWindowsHost
            ? "justify-end px-3 py-1.5"
            : "gap-2 px-5 py-2",
        isCollapsed && shouldReserveMacWindowControls ? "pt-8" : null,
      )}
    >
      {isCollapsed || isWindowsHost ? null : (
        <BrandHeader
          className="flex min-w-0 flex-1 items-center gap-2"
          suffix={<StatusBadge status={connectionStatus} />}
        />
      )}
      <ChatSidebarCollapseButton isCollapsed={isCollapsed} />
    </div>
  );
}

export function ChatSidebarDesktopNav({
  isCollapsed,
}: {
  isCollapsed: boolean;
}) {
  return (
    <>
      <div className={cn("pb-2", isCollapsed ? "px-0" : "px-3")}>
        <ul className={isCollapsed ? SIDEBAR_RAIL_STACK_CLASS : "space-y-0.5"}>
          {navItems.map((item) => (
            <li
              key={item.target}
              className={isCollapsed ? "flex justify-center" : undefined}
            >
              <SidebarNavLinkItem
                to={item.target}
                label={item.label()}
                icon={item.icon}
                density="compact"
                collapsed={isCollapsed}
              />
            </li>
          ))}
        </ul>
      </div>
      <div
        className={cn(
          "border-t border-border/70",
          isCollapsed ? "mx-2 my-1.5" : "mx-4",
        )}
      />
    </>
  );
}

export function ChatSidebarSessionArea({
  defaultSessionType,
  groups,
  isCollapsed,
  isLoading,
  isProjectFirstView,
  onCreateSession,
  onSelectMode,
  projectGroups,
  renderSessionItem,
  sessionTypeOptions,
}: {
  defaultSessionType: string;
  groups: ReturnType<typeof groupSessionsByDate>;
  isCollapsed: boolean;
  isLoading: boolean;
  isProjectFirstView: boolean;
  onCreateSession: (sessionType: string, projectRoot?: string | null) => void;
  onSelectMode: (mode: "time-first" | "project-first") => void;
  projectGroups: ReturnType<typeof groupSessionsByProject>;
  renderSessionItem: (item: NcpSessionListItemView) => JSX.Element;
  sessionTypeOptions: Parameters<
    typeof ChatSidebarSessionList
  >[0]["sessionTypeOptions"];
}) {
  if (isCollapsed) {
    return <div className="min-h-0 flex-1" aria-hidden="true" />;
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 pb-2 pt-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/75">
          {t("chatSidebarTaskRecords")}
        </div>
        <ChatSidebarListModeSwitch
          isProjectFirstView={isProjectFirstView}
          onSelectMode={onSelectMode}
        />
      </div>

      <div
        className={cn(
          "custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-7 pt-2",
          SIDEBAR_SCROLL_EDGE_FADE_CLASS,
        )}
      >
        <ChatSidebarSessionList
          isLoading={isLoading}
          isProjectFirstView={isProjectFirstView}
          groups={groups}
          projectGroups={projectGroups}
          defaultSessionType={defaultSessionType}
          sessionTypeOptions={sessionTypeOptions}
          renderSessionItem={renderSessionItem}
          onCreateSession={onCreateSession}
        />
      </div>
    </>
  );
}

export function ChatSidebarDesktopFooter({
  currentLanguage,
  currentLanguageLabel,
  currentTheme,
  currentThemeLabel,
  isCollapsed,
  isOpen,
  languageOptions,
  onOpenApps,
  onOpenChange,
  onOpenDocs,
  onSelectLanguage,
  onSelectTheme,
  themeOptions,
}: {
  currentLanguage: I18nLanguage;
  currentLanguageLabel: string;
  currentTheme: UiTheme;
  currentThemeLabel: string;
  isCollapsed: boolean;
  isOpen: boolean;
  languageOptions: Array<{ value: I18nLanguage; label: string }>;
  onOpenApps: () => void;
  onOpenChange: (open: boolean) => void;
  onOpenDocs: () => void;
  onSelectLanguage: (language: I18nLanguage) => void;
  onSelectTheme: (theme: UiTheme) => void;
  themeOptions: Array<{
    value: UiTheme;
    label: string;
  }>;
}) {
  return (
    <div
      className={cn(
        "py-3",
        isCollapsed
          ? cn("flex justify-center", SIDEBAR_RAIL_PADDING_X_CLASS)
          : "px-3",
      )}
    >
      <ChatSidebarUtilityMenu
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        currentTheme={currentTheme}
        currentThemeLabel={currentThemeLabel}
        themeOptions={themeOptions}
        onSelectTheme={onSelectTheme}
        currentLanguage={currentLanguage}
        currentLanguageLabel={currentLanguageLabel}
        languageOptions={languageOptions}
        onSelectLanguage={onSelectLanguage}
        onOpenDocs={onOpenDocs}
        onOpenApps={onOpenApps}
        collapsed={isCollapsed}
      />
    </div>
  );
}
