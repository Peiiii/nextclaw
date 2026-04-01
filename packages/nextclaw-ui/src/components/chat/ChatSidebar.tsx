import { useMemo, useState } from 'react';
import type { SessionEntryView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { BrandHeader } from '@/components/common/BrandHeader';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SelectItem } from '@/components/ui/select';
import { ChatSidebarSessionItem } from '@/components/chat/chat-sidebar-session-item';
import { resolveSessionContextView } from '@/lib/session-context.utils';
import { useChatSessionLabel } from '@/components/chat/hooks/use-chat-session-label';
import { useNcpSessionListView, type NcpSessionListItemView } from '@/components/chat/ncp/use-ncp-session-list-view';
import { usePresenter } from '@/components/chat/presenter/chat-presenter-context';
import { useChatInputStore } from '@/components/chat/stores/chat-input.store';
import { useChatSessionListStore } from '@/components/chat/stores/chat-session-list.store';
import { cn } from '@/lib/utils';
import { LANGUAGE_OPTIONS, t, type I18nLanguage } from '@/lib/i18n';
import { THEME_OPTIONS, type UiTheme } from '@/lib/theme';
import { useI18n } from '@/components/providers/I18nProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useDocBrowser } from '@/components/doc-browser';
import { SidebarActionItem, SidebarNavLinkItem, SidebarSelectItem } from '@/components/layout/sidebar-items';
import { useUiStore } from '@/stores/ui.store';
import {
  AlarmClock,
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

function sessionTitle(session: SessionEntryView): string {
  if (session.label && session.label.trim()) {
    return session.label.trim();
  }
  const chunks = session.key.split(':');
  return chunks[chunks.length - 1] || session.key;
}

function resolveSessionTypeStatusText(option: {
  ready?: boolean;
  reasonMessage?: string | null;
}): string {
  if (option.ready === false) {
    return option.reasonMessage?.trim() || t('statusSetup');
  }
  return t('statusReady');
}

const navItems = [
  { target: '/cron', label: () => t('chatSidebarScheduledTasks'), icon: AlarmClock },
  { target: '/skills', label: () => t('chatSidebarSkills'), icon: BrainCircuit },
];

export function ChatSidebar() {
  const presenter = usePresenter();
  const docBrowser = useDocBrowser();
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [editingSessionKey, setEditingSessionKey] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [savingSessionKey, setSavingSessionKey] = useState<string | null>(null);
  const inputSnapshot = useChatInputStore((state) => state.snapshot);
  const listSnapshot = useChatSessionListStore((state) => state.snapshot);
  const connectionStatus = useUiStore((state) => state.connectionStatus);
  const { isLoading, items } = useNcpSessionListView();
  const { language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const updateSessionLabel = useChatSessionLabel();
  const currentThemeLabel = t(THEME_OPTIONS.find((o) => o.value === theme)?.labelKey ?? 'themeWarm');
  const currentLanguageLabel = LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language;

  const groups = useMemo(() => groupSessionsByDate(items), [items]);
  const defaultSessionType = inputSnapshot.defaultSessionType || 'native';
  const nonDefaultSessionTypeOptions = useMemo(
    () => inputSnapshot.sessionTypeOptions.filter((option) => option.value !== defaultSessionType),
    [defaultSessionType, inputSnapshot.sessionTypeOptions]
  );

  const handleLanguageSwitch = (nextLang: I18nLanguage) => {
    if (language === nextLang) return;
    setLanguage(nextLang);
    window.location.reload();
  };

  const startEditingSessionLabel = (session: SessionEntryView) => {
    setEditingSessionKey(session.key);
    setDraftLabel(session.label?.trim() ?? '');
  };

  const cancelEditingSessionLabel = () => {
    setEditingSessionKey(null);
    setDraftLabel('');
    setSavingSessionKey(null);
  };

  const saveSessionLabel = async (session: SessionEntryView) => {
    const normalizedLabel = draftLabel.trim();
    const currentLabel = session.label?.trim() ?? '';
    if (normalizedLabel === currentLabel) {
      cancelEditingSessionLabel();
      return;
    }

    setSavingSessionKey(session.key);
    try {
      await updateSessionLabel({
        sessionKey: session.key,
        label: normalizedLabel || null
      });
      cancelEditingSessionLabel();
    } catch {
      setSavingSessionKey(null);
    }
  };

  return (
    <aside className="w-[280px] shrink-0 flex flex-col h-full bg-secondary border-r border-gray-200/60">
      <div className="px-5 pt-5 pb-3">
        <BrandHeader
          className="flex items-center gap-2.5 min-w-0"
          suffix={<StatusBadge status={connectionStatus} />}
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
              <PopoverContent align="end" className="w-64 p-2">
                <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  {t('chatSessionTypeLabel')}
                </div>
                <div className="mt-1 space-y-1">
                  {nonDefaultSessionTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        presenter.chatSessionListManager.createSession(option.value);
                        setIsCreateMenuOpen(false);
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-100"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[13px] font-medium text-gray-900">{option.label}</div>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            option.ready === false
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-700'
                          )}
                        >
                          {option.ready === false ? t('statusSetup') : t('statusReady')}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-500">
                        {resolveSessionTypeStatusText(option)}
                      </div>
                    </button>
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

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-2">
        {isLoading ? (
          <div className="text-xs text-gray-500 p-3">{t('sessionsLoading')}</div>
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
                  {group.items.map(({ session, runStatus }) => {
                    const active = listSnapshot.selectedSessionKey === session.key;
                    const context = resolveSessionContextView(session, inputSnapshot.sessionTypeOptions);
                    const isEditing = editingSessionKey === session.key;
                    const isSaving = savingSessionKey === session.key;
                    return (
                      <ChatSidebarSessionItem
                        key={session.key}
                        session={session}
                        active={active}
                        runStatus={runStatus}
                        context={context}
                        title={sessionTitle(session)}
                        isEditing={isEditing}
                        draftLabel={draftLabel}
                        isSaving={isSaving}
                        onSelect={() => presenter.chatSessionListManager.selectSession(session.key)}
                        onStartEditing={() => startEditingSessionLabel(session)}
                        onDraftLabelChange={setDraftLabel}
                        onSave={() => saveSessionLabel(session)}
                        onCancel={cancelEditingSessionLabel}
                      />
                    );
                  })}
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
