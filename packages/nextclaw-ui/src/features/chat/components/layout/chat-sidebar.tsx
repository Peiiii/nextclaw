import { useEffect, useMemo, useState } from 'react';
import type { SessionEntryView } from '@/shared/lib/api';
import { BrandHeader } from '@/shared/components/common/brand-header';
import { StatusBadge } from '@/shared/components/common/status-badge';
import { SelectItem } from '@/shared/components/ui/select';
import { ChatSidebarListModeSwitch, ChatSidebarProjectGroups, type ChatSidebarProjectGroup } from '@/features/chat';
import { useChatSidebarSessionLabelEditor } from '@/features/chat/hooks/use-chat-sidebar-session-label-editor';
import { useNcpSessionListView, type NcpSessionListItemView } from '@/features/chat/hooks/use-ncp-session-list-view';
import { usePresenter } from '@/features/chat/components/providers/chat-presenter.provider';
import { useChatInputStore } from '@/features/chat/stores/chat-input.store';
import {
  shouldShowUnreadSessionIndicator,
  useChatSessionListStore
} from '@/features/chat/stores/chat-session-list.store';
import { useSystemStatus } from '@/features/system-status';
import { useAgents } from '@/shared/hooks/use-agents';
import { getSessionProjectName } from '@/shared/lib/session-project';
import { cn } from '@/shared/lib/utils';
import { LANGUAGE_OPTIONS, t, type I18nLanguage } from '@/shared/lib/i18n';
import { THEME_OPTIONS, type UiTheme } from '@/shared/lib/theme';
import { useI18n } from '@/app/components/i18n-provider';
import { useTheme } from '@/app/components/theme-provider';
import { useDocBrowser } from '@/shared/components/doc-browser';
import { SidebarActionItem, SidebarNavLinkItem, SidebarSelectItem } from '@/app/components/layout/sidebar-items';
import {
  AlarmClock,
  Bot,
  BookOpen,
  BrainCircuit,
  Languages,
  MessageSquareText,
  Palette,
  Settings
} from 'lucide-react';
import { ChatSidebarSessionEntry } from '@/features/chat/components/layout/chat-sidebar-session-entry';
import {
  ChatSidebarDesktopToolbar,
  ChatSidebarMobileToolbar,
} from '@/features/chat/components/layout/chat-sidebar-toolbar';

type DateGroup = {
  label: string;
  items: NcpSessionListItemView[];
};

function getSessionUpdatedAtTimestamp(item: NcpSessionListItemView): number {
  return new Date(item.session.updatedAt).getTime();
}

function sortSessionItemsByUpdatedAtDesc(items: NcpSessionListItemView[]): NcpSessionListItemView[] {
  return [...items].sort((left, right) => getSessionUpdatedAtTimestamp(right) - getSessionUpdatedAtTimestamp(left));
}

function groupSessionsByDate(items: NcpSessionListItemView[]): DateGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const sevenDaysStart = todayStart - 7 * 86_400_000;

  const today: NcpSessionListItemView[] = [];
  const yesterday: NcpSessionListItemView[] = [];
  const previous7: NcpSessionListItemView[] = [];
  const older: NcpSessionListItemView[] = [];

  for (const item of items) {
    const { session } = item;
    const ts = new Date(session.updatedAt).getTime();
    if (ts >= todayStart) {
      today.push(item);
    } else if (ts >= yesterdayStart) {
      yesterday.push(item);
    } else if (ts >= sevenDaysStart) {
      previous7.push(item);
    } else {
      older.push(item);
    }
  }

  const groups: DateGroup[] = [];
  if (today.length > 0) groups.push({ label: t('chatSidebarToday'), items: today });
  if (yesterday.length > 0) groups.push({ label: t('chatSidebarYesterday'), items: yesterday });
  if (previous7.length > 0) groups.push({ label: t('chatSidebarPrevious7Days'), items: previous7 });
  if (older.length > 0) groups.push({ label: t('chatSidebarOlder'), items: older });
  return groups;
}

function groupSessionsByProject(items: NcpSessionListItemView[]): ChatSidebarProjectGroup[] {
  const grouped = new Map<string, ChatSidebarProjectGroup>();

  for (const item of items) {
    const projectRoot = item.session.projectRoot?.trim();
    if (!projectRoot) {
      continue;
    }
    const existingGroup = grouped.get(projectRoot);
    const updatedAt = getSessionUpdatedAtTimestamp(item);
    if (existingGroup) {
      existingGroup.items.push(item);
      existingGroup.latestUpdatedAt = Math.max(existingGroup.latestUpdatedAt, updatedAt);
      continue;
    }
    grouped.set(projectRoot, {
      projectRoot,
      projectName: item.session.projectName?.trim() || getSessionProjectName(projectRoot) || projectRoot,
      items: [item],
      latestUpdatedAt: updatedAt
    });
  }

  return [...grouped.values()]
    .map((group) => ({
      ...group,
      items: sortSessionItemsByUpdatedAtDesc(group.items)
    }))
    .sort((left, right) => right.latestUpdatedAt - left.latestUpdatedAt);
}

function sessionTitle(session: SessionEntryView): string {
  if (session.label && session.label.trim()) {
    return session.label.trim();
  }
  const chunks = session.key.split(':');
  return chunks[chunks.length - 1] || session.key;
}

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
      if (!selectedItem) {
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
  const inputSnapshot = useChatInputStore((state) => state.snapshot);
  const listSnapshot = useChatSessionListStore((state) => state.snapshot);
  const systemStatus = useSystemStatus();
  const agentsQuery = useAgents();
  const { isLoading, items } = useNcpSessionListView();
  const { language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const currentThemeLabel = t(THEME_OPTIONS.find((o) => o.value === theme)?.labelKey ?? 'themeWarm');
  const currentLanguageLabel = LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language;
  const agentsById = useMemo(
    () => new Map((agentsQuery.data?.agents ?? []).map((agent) => [agent.id, agent])),
    [agentsQuery.data?.agents]
  );
  const sortedItems = useMemo(() => sortSessionItemsByUpdatedAtDesc(items), [items]);
  const childSessionsByParentKey = useMemo(() => {
    const grouped = new Map<string, NcpSessionListItemView[]>();
    for (const item of items) {
      const parentSessionKey = item.session.parentSessionId?.trim();
      if (!parentSessionKey) {
        continue;
      }
      const bucket = grouped.get(parentSessionKey) ?? [];
      bucket.push(item);
      grouped.set(parentSessionKey, bucket);
    }
    for (const bucket of grouped.values()) {
      bucket.sort((left, right) => getSessionUpdatedAtTimestamp(right) - getSessionUpdatedAtTimestamp(left));
    }
    return grouped;
  }, [items]);
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
  const renderSessionItem = (item: NcpSessionListItemView) =>
    (
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
        sessionTitle={sessionTitle}
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
      />
    );
  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col bg-secondary',
        isMobileVariant
          ? 'flex-1 overflow-hidden'
          : 'w-[280px] shrink-0 border-r border-gray-200/60',
      )}
    >
      {!isMobileVariant ? (
        <div className="px-5 pt-5 pb-3">
          <BrandHeader
            className="flex items-center gap-2.5 min-w-0"
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
          onCreateSession={presenter.chatSessionListManager.createSession}
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
          onCreateSession={presenter.chatSessionListManager.createSession}
          onQueryChange={presenter.chatSessionListManager.setQuery}
        />
      )}

      {!isMobileVariant ? (
        <div className="px-3 pb-2">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              return (
                <li key={item.target}>
                  <SidebarNavLinkItem
                    to={item.target}
                    label={item.label()}
                    icon={item.icon}
                    density="compact"
                  />
                </li>
              );
            })}
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
        {isLoading ? (
          <div className="text-xs text-gray-500 p-3">{t('sessionsLoading')}</div>
        ) : isProjectFirstView ? (
          projectGroups.length === 0 ? (
            <div className="p-4 text-center">
              <MessageSquareText className="h-6 w-6 mx-auto mb-2 text-gray-300" />
              <div className="text-xs text-gray-500">{t('chatSidebarProjectViewEmpty')}</div>
            </div>
          ) : (
            <ChatSidebarProjectGroups
              groups={projectGroups}
              defaultSessionType={defaultSessionType}
              sessionTypeOptions={inputSnapshot.sessionTypeOptions}
              renderSessionItem={renderSessionItem}
              onCreateSession={presenter.chatSessionListManager.createSession}
            />
          )
        ) : groups.length === 0 ? (
          <div className="p-4 text-center">
            <MessageSquareText className="h-6 w-6 mx-auto mb-2 text-gray-300" />
            <div className="text-xs text-gray-500">{t('sessionsEmpty')}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="px-2 py-1 text-[11px] font-medium text-gray-400 uppercase tracking-wider">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map(renderSessionItem)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!isMobileVariant ? (
        <div className="px-3 py-3 border-t border-gray-200/60 space-y-0.5">
          <SidebarNavLinkItem
            to="/settings"
            label={t('settings')}
            icon={Settings}
            density="compact"
          />
          <SidebarActionItem
            onClick={() => docBrowser.open(undefined, { kind: 'docs', newTab: true, title: 'Docs' })}
            icon={BookOpen}
            label={t('docBrowserHelp')}
            density="compact"
          />
          <SidebarSelectItem
            value={theme}
            onValueChange={(value) => setTheme(value as UiTheme)}
            icon={Palette}
            label={t('theme')}
            valueLabel={currentThemeLabel}
            density="compact"
          >
            {THEME_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">{t(option.labelKey)}</SelectItem>
            ))}
          </SidebarSelectItem>
          <SidebarSelectItem
            value={language}
            onValueChange={(value) => handleLanguageSwitch(value as I18nLanguage)}
            icon={Languages}
            label={t('language')}
            valueLabel={currentLanguageLabel}
            density="compact"
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
            ))}
          </SidebarSelectItem>
        </div>
      ) : null}
    </aside>
  );
}
