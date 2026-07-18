import { useEffect, useMemo, useState } from "react";
import {
  getSessionTitle,
  groupChildSessionsByParentKey,
  groupSessionsByDate,
  groupSessionsByProject,
  sortSessionItemsByActivityAtDesc,
} from "@/features/chat/features/session/utils/chat-sidebar-session-groups.utils";
import { useChatSidebarSessionLabelEditor } from "@/features/chat/features/session/hooks/use-chat-sidebar-session-label-editor";
import {
  useNcpSessionListView,
  type NcpSessionListItemView,
} from "@/features/chat/features/ncp/hooks/use-ncp-session-list-view";
import { usePresenter } from "@/features/chat/components/providers/chat-presenter.provider";
import { useChatSessionListStore } from "@/features/chat/stores/chat-session-list.store";
import { useChatQueryStore } from "@/features/chat/stores/ncp-chat-query.store";
import { useSystemStatus } from "@/features/system-status";
import { useAgents } from "@/shared/hooks/use-agents";
import { useCreateProject, useProjects } from "@/shared/hooks/use-projects";
import type { ProjectCreateRequest } from "@/shared/lib/api";
import { normalizeSessionProjectRootValue } from "@/shared/lib/session-project";
import { cn } from "@/shared/lib/utils";
import { LANGUAGE_OPTIONS, t, type I18nLanguage } from "@/shared/lib/i18n";
import { THEME_OPTIONS } from "@/shared/lib/theme";
import { useI18n } from "@/app/components/i18n-provider";
import { useTheme } from "@/app/components/theme-provider";
import { useDocBrowser } from "@/shared/components/doc-browser";
import { ChatSidebarSessionEntry } from "@/features/chat/features/session/components/chat-sidebar-session-entry";
import {
  ChatSidebarDesktopToolbar,
  ChatSidebarMobileToolbar,
} from "@/features/chat/components/layout/chat-sidebar-toolbar";
import {
  ChatSidebarDesktopFooter,
  ChatSidebarDesktopHeader,
  ChatSidebarDesktopNav,
  ChatSidebarSessionArea,
} from "@/features/chat/components/layout/chat-sidebar-desktop-layout";
import { openApps } from "@/features/panel-apps";
import {
  buildSessionTypeOptions,
  DEFAULT_SESSION_TYPE,
  normalizeSessionType,
} from "@/features/chat/features/session-type/utils/chat-session-type.utils";
import { useChatNewSessionTypePreference } from "@/features/chat/features/session-type/hooks/use-chat-new-session-type-preference";
import { useViewportLayoutStore } from "@/app/stores/viewport-layout.store";
import { SIDEBAR_RAIL_WIDTH_CLASS } from "@/app/components/layout/sidebar-rail.styles";
import { ChatProjectCreateDialog } from "@/features/chat/features/project/components/chat-project-create-dialog";

type ChatSidebarVariant = "desktop" | "mobile";

function useChatSessionUnreadState(
  items: readonly NcpSessionListItemView[],
  selectedSessionKey: string | null,
  markSessionRead: (
    sessionKey: string | null | undefined,
    readAt: string | null | undefined,
    currentReadAt?: string | null,
  ) => void,
): Record<string, string> {
  const optimisticReadAtBySessionKey = useChatSessionListStore(
    (state) => state.optimisticReadAtBySessionKey,
  );

  useEffect(() => {
    const syncSelectedSessionReadState = () => {
      if (!selectedSessionKey) {
        return;
      }
      const selectedItem = items.find(
        ({ session }) => session.key === selectedSessionKey,
      );
      if (!selectedItem || selectedItem.runStatus === "running") {
        return;
      }
      const { session: selectedSession } = selectedItem;
      markSessionRead(
        selectedSession.key,
        selectedSession.lastMessageAt,
        selectedSession.readAt,
      );
    };
    syncSelectedSessionReadState();
  }, [items, markSessionRead, selectedSessionKey]);

  return optimisticReadAtBySessionKey;
}

export function ChatSidebar({
  variant = "desktop",
}: {
  variant?: ChatSidebarVariant;
}) {
  const isMobileVariant = variant === "mobile";
  const presenter = usePresenter();
  const docBrowser = useDocBrowser();
  const isSidebarCollapsed = useViewportLayoutStore(
    (state) => state.isSidebarCollapsed,
  );
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isProjectCreateOpen, setIsProjectCreateOpen] = useState(false);
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false);
  const listSnapshot = useChatSessionListStore((state) => state.snapshot);
  const sessionTypesData = useChatQueryStore(
    (state) => state.snapshot.sessionTypesQuery?.data ?? null,
  );
  const config = useChatQueryStore(
    (state) => state.snapshot.configQuery?.data ?? null,
  );
  const systemStatus = useSystemStatus();
  const agentsQuery = useAgents();
  const projectsQuery = useProjects();
  const projectCreateMutation = useCreateProject();
  const { isLoading, items } = useNcpSessionListView();
  const { language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const currentThemeLabel = t(
    THEME_OPTIONS.find((o) => o.value === theme)?.labelKey ?? "themeWork",
  );
  const currentLanguageLabel =
    LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language;
  const utilityThemeOptions = useMemo(
    () =>
      THEME_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
      })),
    [],
  );
  const utilityLanguageOptions = useMemo(
    () =>
      LANGUAGE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [],
  );
  const agentsById = useMemo(
    () =>
      new Map(
        (agentsQuery.data?.agents ?? []).map((agent) => [agent.id, agent]),
      ),
    [agentsQuery.data?.agents],
  );
  const pinnedSessionKeys = useMemo(
    () => new Set(listSnapshot.pinnedSessionKeys),
    [listSnapshot.pinnedSessionKeys],
  );
  const pinnedProjectRoots = useMemo(
    () => new Set(listSnapshot.pinnedProjectRoots),
    [listSnapshot.pinnedProjectRoots],
  );
  const sortedItems = useMemo(
    () => sortSessionItemsByActivityAtDesc(items),
    [items],
  );
  const childSessionsByParentKey = useMemo(
    () => groupChildSessionsByParentKey(items),
    [items],
  );
  const groups = useMemo(
    () => groupSessionsByDate(sortedItems, pinnedSessionKeys),
    [pinnedSessionKeys, sortedItems],
  );
  const projectGroups = useMemo(
    () => groupSessionsByProject(
      sortedItems,
      pinnedSessionKeys,
      pinnedProjectRoots,
      projectsQuery.data?.projects ?? [],
    ),
    [pinnedProjectRoots, pinnedSessionKeys, projectsQuery.data?.projects, sortedItems],
  );
  const sessionTypeOptions = useMemo(
    () => buildSessionTypeOptions(sessionTypesData?.options ?? []),
    [sessionTypesData?.options],
  );
  const defaultSessionType = useMemo(
    () =>
      normalizeSessionType(
        sessionTypesData?.defaultType ?? DEFAULT_SESSION_TYPE,
      ),
    [sessionTypesData?.defaultType],
  );
  const newSessionTypePreference = useChatNewSessionTypePreference({
    defaultSessionType,
    sessionTypeOptions,
  });
  const isProjectFirstView = listSnapshot.listMode === "project-first";
  const shouldCollapse = !isMobileVariant && isSidebarCollapsed;
  const optimisticReadAtBySessionKey = useChatSessionUnreadState(
    items,
    listSnapshot.selectedSessionKey,
    presenter.chatSessionListManager.markSessionRead,
  );
  const {
    editingSessionKey,
    draftLabel,
    savingSessionKey,
    setDraftLabel,
    startEditingSessionLabel,
    cancelEditingSessionLabel,
    saveSessionLabel,
  } = useChatSidebarSessionLabelEditor();
  const handleLanguageSwitch = (nextLang: I18nLanguage) => {
    if (language === nextLang) return;
    setLanguage(nextLang);
    window.location.reload();
  };
  const renderSessionItem = (item: NcpSessionListItemView) => (
    <ChatSidebarSessionEntry
      key={item.session.key}
      item={item}
      selectedSessionKey={listSnapshot.selectedSessionKey}
      optimisticReadAtBySessionKey={optimisticReadAtBySessionKey}
      agentsById={agentsById}
      childSessionsByParentKey={childSessionsByParentKey}
      editingSessionKey={editingSessionKey}
      draftLabel={draftLabel}
      savingSessionKey={savingSessionKey}
      sessionTypeOptions={sessionTypeOptions}
      isPinned={pinnedSessionKeys.has(item.session.key)}
      sessionTitle={getSessionTitle}
      onSelectSession={presenter.chatSessionListManager.selectSession}
      onOpenChildSessions={(parentSessionKey, activeChildSessionKey) =>
        presenter.chatThreadManager.openChildSessionPanel({
          parentSessionKey,
          activeChildSessionKey,
        })
      }
      onStartEditingSessionLabel={startEditingSessionLabel}
      onDraftLabelChange={setDraftLabel}
      onSaveSessionLabel={saveSessionLabel}
      onCancelEditingSessionLabel={cancelEditingSessionLabel}
      onTogglePinned={() =>
        presenter.chatSessionListManager.toggleSessionPinned(item.session.key)
      }
    />
  );
  const createSessionAndOpenIfNeeded = (
    sessionType: string,
    projectRoot?: string | null,
  ) => {
    presenter.chatSessionListManager.createSession({
      projectRoot: typeof projectRoot === "string" ? projectRoot : undefined,
      sessionType,
    });
  };
  const openProjectCreate = () => {
    projectCreateMutation.reset();
    setIsProjectCreateOpen(true);
  };
  const createProjectFromSidebar = async (input: ProjectCreateRequest): Promise<void> => {
    await projectCreateMutation.mutateAsync(input);
    setIsProjectCreateOpen(false);
  };

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col bg-secondary transition-[width] duration-200 ease-out",
        isMobileVariant
          ? "flex-1 overflow-hidden"
          : shouldCollapse
            ? cn(
                SIDEBAR_RAIL_WIDTH_CLASS,
                "shrink-0",
              )
            : "w-[280px] shrink-0",
      )}
      data-sidebar-collapsed={shouldCollapse ? "true" : "false"}
    >
      {!isMobileVariant ? (
        <ChatSidebarDesktopHeader
          connectionStatus={systemStatus.connectionStatus}
          isCollapsed={shouldCollapse}
        />
      ) : null}

      {isMobileVariant ? (
        <ChatSidebarMobileToolbar
          query={listSnapshot.query}
          defaultSessionType={newSessionTypePreference.selectedSessionType}
          sessionTypeOptions={sessionTypeOptions}
          selectedNewSessionType={newSessionTypePreference.selectedSessionType}
          selectedNewSessionTypeOption={
            newSessionTypePreference.selectedSessionTypeOption
          }
          isCreateMenuOpen={isCreateMenuOpen}
          onCreateMenuOpenChange={setIsCreateMenuOpen}
          onCreateSession={createSessionAndOpenIfNeeded}
          onSelectNewSessionType={
            newSessionTypePreference.setSelectedSessionType
          }
          onQueryChange={presenter.chatSessionListManager.setQuery}
        />
      ) : (
        <ChatSidebarDesktopToolbar
          query={listSnapshot.query}
          defaultSessionType={defaultSessionType}
          sessionTypeOptions={sessionTypeOptions}
          selectedNewSessionType={newSessionTypePreference.selectedSessionType}
          selectedNewSessionTypeOption={
            newSessionTypePreference.selectedSessionTypeOption
          }
          isCreateMenuOpen={isCreateMenuOpen}
          onCreateMenuOpenChange={setIsCreateMenuOpen}
          onCreateSession={createSessionAndOpenIfNeeded}
          onSelectNewSessionType={
            newSessionTypePreference.setSelectedSessionType
          }
          onQueryChange={presenter.chatSessionListManager.setQuery}
          collapsed={shouldCollapse}
        />
      )}

      {!isMobileVariant ? (
        <ChatSidebarDesktopNav isCollapsed={shouldCollapse} />
      ) : null}

      <ChatSidebarSessionArea
        defaultSessionType={newSessionTypePreference.selectedSessionType}
        groups={groups}
        isCollapsed={shouldCollapse}
        isLoading={isLoading}
        isProjectFirstView={isProjectFirstView}
        onCreateProject={openProjectCreate}
        onSelectMode={presenter.chatSessionListManager.setListMode}
        projectGroups={projectGroups}
        renderSessionItem={renderSessionItem}
        sessionTypeOptions={sessionTypeOptions}
      />

      {!isMobileVariant ? (
        <ChatSidebarDesktopFooter
          currentLanguage={language}
          currentLanguageLabel={currentLanguageLabel}
          currentTheme={theme}
          currentThemeLabel={currentThemeLabel}
          isCollapsed={shouldCollapse}
          isOpen={isUtilityMenuOpen}
          languageOptions={utilityLanguageOptions}
          onOpenApps={() => openApps(docBrowser)}
          onOpenChange={setIsUtilityMenuOpen}
          onOpenDocs={() =>
            docBrowser.open(undefined, {
              kind: "docs",
              title: t("docBrowserHelp"),
            })
          }
          onSelectLanguage={handleLanguageSwitch}
          onSelectTheme={setTheme}
          themeOptions={utilityThemeOptions}
        />
      ) : null}

      <ChatProjectCreateDialog
        open={isProjectCreateOpen}
        defaultWorkspacePath={normalizeSessionProjectRootValue(
          config?.agents.defaults.workspace,
        )}
        templates={projectsQuery.data?.templates ?? []}
        isCreating={projectCreateMutation.isPending}
        errorMessage={projectCreateMutation.error?.message}
        onOpenChange={setIsProjectCreateOpen}
        onCreate={createProjectFromSidebar}
      />
    </aside>
  );
}
