import { useEffect, useMemo, useState } from 'react';
import type { SessionEntryView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { BrandHeader } from '@/components/common/BrandHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SelectItem } from '@/components/ui/select';
import { ChatSidebarSessionItem } from '@/components/chat/chat-sidebar-session-item';
import { ChatSessionTypeOptionItem } from '@/components/chat/chat-session-type-option-item';
import { ChatSidebarListModeSwitch } from '@/components/chat/chat-sidebar-list-mode-switch';
import {
  ChatSidebarProjectGroups,
  type ChatSidebarProjectGroup
} from '@/components/chat/chat-sidebar-project-groups';
import { resolveSessionContextView } from '@/lib/session-context.utils';
import { useChatSidebarSessionLabelEditor } from '@/components/chat/hooks/use-chat-sidebar-session-label-editor';
import { useNcpSessionListView, type NcpSessionListItemView } from '@/components/chat/ncp/use-ncp-session-list-view';
import { usePresenter } from '@/components/chat/presenter/chat-presenter-context';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import {
  shouldShowUnreadSessionIndicator,
  useChatSessionListStore
} from '@/components/chat/stores/chat-session-list.store';
import { useAgents } from '@/hooks/agents/useAgents';
import { getSessionProjectName } from '@/lib/session-project/session-project.utils';
import { cn } from '@/lib/utils';
import { LANGUAGE_OPTIONS, t, type I18nLanguage } from '@/lib/i18n';
import { THEME_OPTIONS, type UiTheme } from '@/lib/theme';
import { useI18n } from '@/components/providers/I18nProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useDocBrowser } from '@/components/doc-browser';
import { SidebarActionItem, SidebarNavLinkItem, SidebarSelectItem } from '@/components/layout/sidebar-items';
import { useSystemStatus } from '@/features/system-status';
import {
  AlarmClock,
  Bot,
  BookOpen,
  BrainCircuit,
  ChevronDown,
  Languages,
  MessageSquareText,
  Palette,
  Plus,
  Search,
  Settings
} from 'lucide-react';

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
export function ChatSidebar() {
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
  const renderSessionItem = ({ session, runStatus }: NcpSessionListItemView) => {
    const active = listSnapshot.selectedSessionKey === session.key;
    const optimisticReadAt = optimisticReadAtBySessionKey[session.key];
    const effectiveReadAt =
      optimisticReadAt && session.readAt
        ? (optimisticReadAt.localeCompare(session.readAt) > 0 ? optimisticReadAt : session.readAt)
        : optimisticReadAt ?? session.readAt;
    const showUnreadDot = shouldShowUnreadSessionIndicator({
      active,
      lastMessageAt: session.lastMessageAt,
      readAt: effectiveReadAt,
      runStatus,
    });
    const context = resolveSessionContextView(session, inputSnapshot.sessionTypeOptions);
    const isEditing = editingSessionKey === session.key;
    const isSaving = savingSessionKey === session.key;
    const childSessions = childSessionsByParentKey.get(session.key) ?? [];
    return (
      <ChatSidebarSessionItem
        key={session.key}
        session={session}
        active={active}
        showUnreadDot={showUnreadDot}
        runStatus={runStatus}
        context={context}
        title={sessionTitle(session)}
        agentId={session.agentId ?? null}
        agentLabel={session.agentId ? (agentsById.get(session.agentId)?.displayName ?? session.agentId) : null}
        agentAvatarUrl={session.agentId ? (agentsById.get(session.agentId)?.avatarUrl ?? null) : null}
        childSessionCount={childSessions.length}
        isEditing={isEditing}
        draftLabel={draftLabel}
        isSaving={isSaving}
        onSelect={() => presenter.chatSessionListManager.selectSession(session.key)}
        onOpenChildSessions={() =>
          presenter.chatThreadManager.openChildSessionPanel({
            parentSessionKey: session.key,
            activeChildSessionKey: childSessions[0]?.session.key ?? null,
          })
        }
        onStartEditing={() => startEditingSessionLabel(session)}
        onDraftLabelChange={setDraftLabel}
        onSave={() => saveSessionLabel(session)}
        onCancel={cancelEditingSessionLabel}
      />
    );
  };
  return (
    <aside className="w-[280px] shrink-0 flex flex-col h-full bg-secondary border-r border-gray-200/60">
      <div className="px-5 pt-5 pb-3">
        <BrandHeader
          className="flex items-center gap-2.5 min-w-0"
          suffix={<StatusBadge status={systemStatus.connectionStatus} />}
        />
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            className={cn(
              'min-w-0 rounded-xl',
              nonDefaultSessionTypeOptions.length > 0 ? 'flex-1 rounded-r-md' : 'w-full'
            )}
            onClick={() => {
              setIsCreateMenuOpen(false);
              presenter.chatSessionListManager.createSession(defaultSessionType);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('chatSidebarNewTask')}
          </Button>
          {nonDefaultSessionTypeOptions.length > 0 ? (
            <Popover open={isCreateMenuOpen} onOpenChange={setIsCreateMenuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="primary"
                  size="icon"
                  className="h-9 w-10 shrink-0 rounded-xl rounded-l-md"
                  aria-label={t('chatSessionTypeLabel')}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-56 rounded-2xl border border-gray-200/80 bg-white p-1.5 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]"
              >
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                  {t('chatSessionTypeLabel')}
                </div>
                <div className="space-y-1">
                  {nonDefaultSessionTypeOptions.map((option) => (
                    <ChatSessionTypeOptionItem
                      key={option.value}
                      option={option}
                      onSelect={() => {
                        presenter.chatSessionListManager.createSession(option.value);
                        setIsCreateMenuOpen(false);
                      }}
                    />
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-gray-400" />
          <Input
            value={listSnapshot.query}
            onChange={(event) => presenter.chatSessionListManager.setQuery(event.target.value)}
            placeholder={t('chatSidebarSearchPlaceholder')}
            className="pl-8 h-9 rounded-lg text-xs"
          />
        </div>
      </div>

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

      <div className="mx-4 border-t border-gray-200/60" />

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
    </aside>
  );
}
