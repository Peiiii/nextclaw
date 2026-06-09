import { useEffect, useMemo, useState } from 'react';
import { BrandHeader } from '@/shared/components/common/brand-header';
import { StatusBadge } from '@/shared/components/common/status-badge';
import { ChatSidebarListModeSwitch } from '@/features/chat/components/chat-sidebar-list-mode-switch';
import {
  getSessionTitle,
  groupChildSessionsByParentKey,
  groupSessionsByDate,
  groupSessionsByProject,
  sortSessionItemsByActivityAtDesc,
} from '@/features/chat/features/session/utils/chat-sidebar-session-groups.utils';
import { useChatSidebarSessionLabelEditor } from '@/features/chat/features/session/hooks/use-chat-sidebar-session-label-editor';
import { useNcpSessionListView, type NcpSessionListItemView } from '@/features/chat/features/ncp/hooks/use-ncp-session-list-view';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/features/chat/stores/chat-session-list.store';
import { useSystemStatus } from '@/features/system-status';
import { useAgents } from '@/shared/hooks/use-agents';
import { cn } from '@/shared/lib/utils';
import { LANGUAGE_OPTIONS, t, type I18nLanguage } from '@/shared/lib/i18n';
import { THEME_OPTIONS } from '@/shared/lib/theme';
import { useI18n } from '@/app/components/i18n-provider';
import { useTheme } from '@/app/components/theme-provider';
import { useDocBrowser } from '@/shared/components/doc-browser';
import { SidebarNavLinkItem } from '@/app/components/layout/sidebar-items';
import {
  AlarmClock,
  Bot,
  BrainCircuit,
} from 'lucide-react';
import { ChatSidebarSessionEntry } from '@/features/chat/components/layout/chat-sidebar-session-entry';
import { ChatSidebarSessionList } from '@/features/chat/components/layout/chat-sidebar-session-list';
import {
  ChatSidebarDesktopToolbar,
  ChatSidebarMobileToolbar,
} from '@/features/chat/components/layout/chat-sidebar-toolbar';
import { ChatSidebarUtilityMenu } from '@/features/chat/components/layout/chat-sidebar-utility-menu';
import { openApps } from '@/features/panel-apps';
import { isWindowsDesktopHost } from '@/platforms/desktop';

const navItems = [
  { target: '/cron', label: () => t('chatSidebarScheduledTasks'), icon: AlarmClock },
  { target: '/skills', label: () => t('chatSidebarSkills'), icon: BrainCircuit },
  { target: '/agents', label: () => t('agentsPageTitle'), icon: Bot },
];

type ChatSidebarVariant = 'desktop' | 'mobile';

function useChatSessionUnreadState(
  items: readonly NcpSessionListItemView[],
  selectedSessionKey: string | null,
  markSessionRead: (
    sessionKey: string | null | undefined,
    readAt: string | null | undefined,
    currentReadAt?: string | null,
  ) => void,
): Record<string, string> {
  const optimisticReadAtBySessionKey = useChatSessionListStore((state) => state.optimisticReadAtBySessionKey);

  useEffect(() => {
    const syncSelectedSessionReadState = () => {
      if (!selectedSessionKey) {
        return;
      }
      const selectedItem = items.find(({ session }) => session.key === selectedSessionKey);
      if (!selectedItem || selectedItem.runStatus === 'running') {
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
  variant = 'desktop',
}: {
  variant?: ChatSidebarVariant;
}) {
  const isMobileVariant = variant === 'mobile';
  const presenter = usePresenter();
  const docBrowser = useDocBrowser();
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isUtilityMenuOpen, setIsUtilityMenuOpen] = useState(false);
  const inputSnapshot = useChatInputStore((state) => state.snapshot);
  const listSnapshot = useChatSessionListStore((state) => state.snapshot);
  const systemStatus = useSystemStatus();
  const agentsQuery = useAgents();
  const { isLoading, items } = useNcpSessionListView();
  const { language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const currentThemeLabel = t(THEME_OPTIONS.find((o) => o.value === theme)?.labelKey ?? 'themeWarm');
  const currentLanguageLabel = LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language;
  const utilityThemeOptions = useMemo(
    () => THEME_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
    [],
  );
  const utilityLanguageOptions = useMemo(
    () => LANGUAGE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    [],
  );
  const agentsById = useMemo(
    () => new Map((agentsQuery.data?.agents ?? []).map((agent) => [agent.id, agent])),
    [agentsQuery.data?.agents]
  );
  const sortedItems = useMemo(() => sortSessionItemsByActivityAtDesc(items), [items]);
  const childSessionsByParentKey = useMemo(() => groupChildSessionsByParentKey(items), [items]);
  const groups = useMemo(() => groupSessionsByDate(sortedItems), [sortedItems]);
  const projectGroups = useMemo(() => groupSessionsByProject(sortedItems), [sortedItems]);
  const defaultSessionType = inputSnapshot.defaultSessionType || 'native';
  const nonDefaultSessionTypeOptions = useMemo(
    () => inputSnapshot.sessionTypeOptions.filter((option) => option.value !== defaultSessionType),
    [defaultSessionType, inputSnapshot.sessionTypeOptions]
  );
  const isProjectFirstView = listSnapshot.listMode === 'project-first';
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
      sessionTitle={getSessionTitle}
      onSelectSession={presenter.chatSessionListManager.selectSession}
      onOpenChildSessions={(parentSessionKey, activeChildSessionKey) => presenter.chatThreadManager.openChildSessionPanel({ parentSessionKey, activeChildSessionKey })}
      onStartEditingSessionLabel={startEditingSessionLabel}
      onDraftLabelChange={setDraftLabel}
      onSaveSessionLabel={saveSessionLabel}
      onCancelEditingSessionLabel={cancelEditingSessionLabel}
    />
  );
  const createSessionAndOpenIfNeeded = (sessionType: string, projectRoot?: string | null) => {
    presenter.chatSessionListManager.createSession(sessionType, typeof projectRoot === "string" ? projectRoot : undefined);
  };

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col bg-secondary',
        isMobileVariant
          ? 'flex-1 overflow-hidden'
          : 'w-[280px] shrink-0 border-r border-gray-200/60',
      )}
    >
      {!isMobileVariant && !isWindowsDesktopHost() ? (
        <div className="px-5 py-2.5">
          <BrandHeader
            className="flex min-w-0 items-center gap-2"
            suffix={<StatusBadge status={systemStatus.connectionStatus} />}
          />
        </div>
      ) : null}

      {isMobileVariant ? (
        <ChatSidebarMobileToolbar
          query={listSnapshot.query}
          defaultSessionType={defaultSessionType}
          sessionTypeOptions={inputSnapshot.sessionTypeOptions}
          nonDefaultSessionTypeOptions={nonDefaultSessionTypeOptions}
          isCreateMenuOpen={isCreateMenuOpen}
          onCreateMenuOpenChange={setIsCreateMenuOpen}
          onCreateSession={createSessionAndOpenIfNeeded}
          onQueryChange={presenter.chatSessionListManager.setQuery}
        />
      ) : (
        <ChatSidebarDesktopToolbar
          query={listSnapshot.query}
          defaultSessionType={defaultSessionType}
          sessionTypeOptions={inputSnapshot.sessionTypeOptions}
          nonDefaultSessionTypeOptions={nonDefaultSessionTypeOptions}
          isCreateMenuOpen={isCreateMenuOpen}
          onCreateMenuOpenChange={setIsCreateMenuOpen}
          onCreateSession={createSessionAndOpenIfNeeded}
          onQueryChange={presenter.chatSessionListManager.setQuery}
        />
      )}

      {!isMobileVariant ? (
        <div className="px-3 pb-2">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.target}>
                <SidebarNavLinkItem to={item.target} label={item.label()} icon={item.icon} density="compact" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isMobileVariant ? (
        <div className="mx-4 border-t border-gray-200/60" />
      ) : null}

      <div className="flex items-center justify-between px-5 pb-2 pt-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
          {t('chatSidebarTaskRecords')}
        </div>
        <ChatSidebarListModeSwitch
          isProjectFirstView={isProjectFirstView}
          onSelectMode={presenter.chatSessionListManager.setListMode}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-2">
        <ChatSidebarSessionList
          isLoading={isLoading}
          isProjectFirstView={isProjectFirstView}
          groups={groups}
          projectGroups={projectGroups}
          defaultSessionType={defaultSessionType}
          sessionTypeOptions={inputSnapshot.sessionTypeOptions}
          renderSessionItem={renderSessionItem}
          onCreateSession={createSessionAndOpenIfNeeded}
        />
      </div>

      {!isMobileVariant ? (
        <div className="px-3 py-3 border-t border-gray-200/60">
          <ChatSidebarUtilityMenu
            isOpen={isUtilityMenuOpen}
            onOpenChange={setIsUtilityMenuOpen}
            currentTheme={theme}
            currentThemeLabel={currentThemeLabel}
            themeOptions={utilityThemeOptions}
            onSelectTheme={setTheme}
            currentLanguage={language}
            currentLanguageLabel={currentLanguageLabel}
            languageOptions={utilityLanguageOptions}
            onSelectLanguage={handleLanguageSwitch}
            onOpenDocs={() => docBrowser.open(undefined, { kind: 'docs', title: t('docBrowserHelp') })}
            onOpenApps={() => openApps(docBrowser)}
          />
        </div>
      ) : null}
    </aside>
  );
}
