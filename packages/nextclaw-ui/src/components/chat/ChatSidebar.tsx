import { useMemo } from 'react';
import type { SessionEntryView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { SessionRunBadge } from '@/components/common/SessionRunBadge';
import { cn } from '@/lib/utils';
import { LANGUAGE_OPTIONS, formatDateTime, t, type I18nLanguage } from '@/lib/i18n';
import type { SessionRunStatus } from '@/lib/session-run-status';
import { THEME_OPTIONS, type UiTheme } from '@/lib/theme';
import { useI18n } from '@/components/providers/I18nProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { NavLink } from 'react-router-dom';
import { AlarmClock, BrainCircuit, Languages, MessageSquareText, Palette, Plus, Search, Settings } from 'lucide-react';

type ChatSidebarProps = {
  sessions: SessionEntryView[];
  sessionRunStatusByKey: ReadonlyMap<string, SessionRunStatus>;
  selectedSessionKey: string | null;
  onSelectSession: (key: string) => void;
  onCreateSession: () => void;
  sessionTitle: (session: SessionEntryView) => string;
  isLoading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
};

type DateGroup = {
  label: string;
  sessions: SessionEntryView[];
};

function groupSessionsByDate(sessions: SessionEntryView[]): DateGroup[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const sevenDaysStart = todayStart - 7 * 86_400_000;

  const today: SessionEntryView[] = [];
  const yesterday: SessionEntryView[] = [];
  const previous7: SessionEntryView[] = [];
  const older: SessionEntryView[] = [];

  for (const session of sessions) {
    const ts = new Date(session.updatedAt).getTime();
    if (ts >= todayStart) {
      today.push(session);
    } else if (ts >= yesterdayStart) {
      yesterday.push(session);
    } else if (ts >= sevenDaysStart) {
      previous7.push(session);
    } else {
      older.push(session);
    }
  }

  const groups: DateGroup[] = [];
  if (today.length > 0) groups.push({ label: t('chatSidebarToday'), sessions: today });
  if (yesterday.length > 0) groups.push({ label: t('chatSidebarYesterday'), sessions: yesterday });
  if (previous7.length > 0) groups.push({ label: t('chatSidebarPrevious7Days'), sessions: previous7 });
  if (older.length > 0) groups.push({ label: t('chatSidebarOlder'), sessions: older });
  return groups;
}

const navItems = [
  { target: '/cron', label: () => t('chatSidebarScheduledTasks'), icon: AlarmClock },
  { target: '/skills', label: () => t('chatSidebarSkills'), icon: BrainCircuit },
];

export function ChatSidebar(props: ChatSidebarProps) {
  const { language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const currentThemeLabel = t(THEME_OPTIONS.find((o) => o.value === theme)?.labelKey ?? 'themeWarm');
  const currentLanguageLabel = LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language;

  const groups = useMemo(() => groupSessionsByDate(props.sessions), [props.sessions]);

  const handleLanguageSwitch = (nextLang: I18nLanguage) => {
    if (language === nextLang) return;
    setLanguage(nextLang);
    window.location.reload();
  };

  return (
    <aside className="w-[280px] shrink-0 flex flex-col h-full bg-secondary border-r border-gray-200/60">
      {/* Logo */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg overflow-hidden flex items-center justify-center">
            <img src="/logo.svg" alt="NextClaw" className="h-full w-full object-contain" />
          </div>
          <span className="text-[15px] font-semibold text-gray-800 tracking-[-0.01em]">NextClaw</span>
        </div>
      </div>

      {/* New Task button */}
      <div className="px-4 pb-3">
        <Button variant="primary" className="w-full rounded-xl" onClick={props.onCreateSession}>
          <Plus className="h-4 w-4 mr-2" />
          {t('chatSidebarNewTask')}
        </Button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-gray-400" />
          <Input
            value={props.query}
            onChange={(e) => props.onQueryChange(e.target.value)}
            placeholder={t('chatSidebarSearchPlaceholder')}
            className="pl-8 h-9 rounded-lg text-xs"
          />
        </div>
      </div>

      {/* Navigation shortcuts */}
      <div className="px-3 pb-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.target}>
                <NavLink
                  to={item.target}
                  className={({ isActive }) => cn(
                    'group w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150',
                    isActive
                      ? 'bg-gray-200 text-gray-900 font-semibold shadow-sm'
                      : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn(
                        'h-4 w-4 transition-colors',
                        isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-800'
                      )} />
                      <span>{item.label()}</span>
                    </>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-gray-200/60" />

      {/* Session history */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-2">
        {props.isLoading ? (
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
                  {group.sessions.map((session) => {
                    const active = props.selectedSessionKey === session.key;
                    const runStatus = props.sessionRunStatusByKey.get(session.key);
                    return (
                      <button
                        key={session.key}
                        onClick={() => props.onSelectSession(session.key)}
                        className={cn(
                          'w-full rounded-xl px-3 py-2 text-left transition-all text-[13px]',
                          active
                            ? 'bg-gray-200 text-gray-900 font-semibold shadow-sm'
                            : 'text-gray-700 hover:bg-gray-200/60 hover:text-gray-900'
                        )}
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_0.875rem] items-center gap-1.5">
                          <span className="truncate font-medium">{props.sessionTitle(session)}</span>
                          <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                            {runStatus ? <SessionRunBadge status={runStatus} /> : null}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-400 truncate">
                          {session.messageCount} · {formatDateTime(session.updatedAt)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings footer */}
      <div className="px-3 py-3 border-t border-gray-200/60 space-y-0.5">
        <NavLink
          to="/settings"
          className={({ isActive }) => cn(
            'group w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-150',
            isActive
              ? 'bg-gray-200 text-gray-900 font-semibold shadow-sm'
              : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
          )}
        >
          {({ isActive }) => (
            <>
              <Settings className={cn('h-4 w-4 transition-colors', isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-800')} />
              <span>{t('settings')}</span>
            </>
          )}
        </NavLink>
        <Select value={theme} onValueChange={(v) => setTheme(v as UiTheme)}>
          <SelectTrigger className="w-full h-auto rounded-xl border-0 bg-transparent shadow-none px-3 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-200/60 focus:ring-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <Palette className="h-4 w-4 text-gray-400" />
              <span>{t('theme')}</span>
            </div>
            <span className="ml-auto text-[11px] text-gray-500">{currentThemeLabel}</span>
          </SelectTrigger>
          <SelectContent>
            {THEME_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{t(o.labelKey)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={language} onValueChange={(v) => handleLanguageSwitch(v as I18nLanguage)}>
          <SelectTrigger className="w-full h-auto rounded-xl border-0 bg-transparent shadow-none px-3 py-2 text-[13px] font-medium text-gray-600 hover:bg-gray-200/60 focus:ring-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <Languages className="h-4 w-4 text-gray-400" />
              <span>{t('language')}</span>
            </div>
            <span className="ml-auto text-[11px] text-gray-500">{currentLanguageLabel}</span>
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </aside>
  );
}
