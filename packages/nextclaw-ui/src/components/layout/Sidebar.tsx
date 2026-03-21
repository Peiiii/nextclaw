import { cn } from '@/lib/utils';
import { LANGUAGE_OPTIONS, t, type I18nLanguage } from '@/lib/i18n';
import { THEME_OPTIONS, type UiTheme } from '@/lib/theme';
import { Cpu, GitBranch, History, MessageCircle, MessageSquare, Sparkles, BookOpen, Plug, BrainCircuit, AlarmClock, Languages, Palette, KeyRound, Settings, ArrowLeft, Search, Shield, Wrench, Wifi } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useDocBrowser } from '@/components/doc-browser';
import { BrandHeader } from '@/components/common/BrandHeader';
import { useI18n } from '@/components/providers/I18nProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useRemoteStatus } from '@/hooks/useRemoteAccess';
import { useAppPresenter } from '@/presenter/app-presenter-context';

type SidebarMode = 'main' | 'settings';

type SidebarProps = {
  mode: SidebarMode;
};

export function Sidebar({ mode }: SidebarProps) {
  const presenter = useAppPresenter();
  const docBrowser = useDocBrowser();
  const remoteStatus = useRemoteStatus();
  const { language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const currentLanguageLabel = LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? language;
  const currentThemeLabel = t(THEME_OPTIONS.find((option) => option.value === theme)?.labelKey ?? 'themeWarm');
  const accountEmail = remoteStatus.data?.account.email?.trim();
  const accountConnected = Boolean(remoteStatus.data?.account.loggedIn);

  const handleLanguageSwitch = (nextLanguage: I18nLanguage) => {
    if (language === nextLanguage) {
      return;
    }
    setLanguage(nextLanguage);
    window.location.reload();
  };

  const handleThemeSwitch = (nextTheme: UiTheme) => {
    if (theme === nextTheme) {
      return;
    }
    setTheme(nextTheme);
  };

  // Core navigation items - primary features
  const mainNavItems = [
    {
      target: '/chat',
      label: t('chat'),
      icon: MessageCircle,
    },
    {
      target: '/chat/cron',
      label: t('cron'),
      icon: AlarmClock,
    },
    {
      target: '/chat/skills',
      label: t('marketplaceFilterSkills'),
      icon: BrainCircuit,
    }
  ];

  const settingsNavItems = [
    {
      target: '/model',
      label: t('model'),
      icon: Cpu,
    },
    {
      target: '/providers',
      label: t('providers'),
      icon: Sparkles,
    },
    {
      target: '/search',
      label: t('searchChannels'),
      icon: Search,
    },
    {
      target: '/channels',
      label: t('channels'),
      icon: MessageSquare,
    },
    {
      target: '/runtime',
      label: t('runtime'),
      icon: GitBranch,
    },
    {
      target: '/remote',
      label: t('remote'),
      icon: Wifi,
    },
    {
      target: '/security',
      label: t('security'),
      icon: Shield,
    },
    {
      target: '/sessions',
      label: t('sessions'),
      icon: History,
    },
    {
      target: '/secrets',
      label: t('secrets'),
      icon: KeyRound,
    },
    {
      target: '/marketplace/plugins',
      label: t('marketplaceFilterPlugins'),
      icon: Plug,
    },
    {
      target: '/marketplace/mcp',
      label: t('marketplaceFilterMcp'),
      icon: Wrench,
    }
  ];
  const navItems = mode === 'main' ? mainNavItems : settingsNavItems;

  return (
    <aside className="w-[240px] shrink-0 flex flex-col h-full py-6 px-4 bg-secondary">
      {mode === 'settings' ? (
        <div className="px-2 mb-6">
          <NavLink
            to="/chat"
            className="group inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-gray-500 group-hover:text-gray-800" />
            <span>{t('backToMain')}</span>
          </NavLink>
          <div className="mt-5 px-1">
            <div className="flex items-center gap-2.5">
              <Settings className="h-5 w-5 text-gray-700" />
              <h1 className="text-[28px] leading-none font-semibold tracking-[-0.02em] text-gray-900">{t('settings')}</h1>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-2 mb-8">
          <BrandHeader className="flex items-center gap-2.5 cursor-pointer" />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 flex flex-col">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <li key={item.target}>
                <NavLink
                  to={item.target}
                  className={({ isActive }) => cn(
                    'group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-base',
                    isActive
                      ? 'bg-gray-200 text-gray-900 font-semibold shadow-sm'
                      : 'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900'
                  )}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn(
                        'h-[17px] w-[17px] transition-colors',
                        isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-800'
                      )} />
                      <span className="flex-1 text-left">{item.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
              );
            })}
          </ul>
      </nav>

      {/* Help Button */}
      <div className="pt-3 border-t border-[#dde0ea] mt-3">
        {mode === 'settings' ? (
          <button
            onClick={() => presenter.accountManager.openAccountPanel()}
            className="mb-2 w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:bg-gray-50"
          >
            <div className="flex items-start gap-3">
              <div className={cn('mt-0.5 rounded-full p-2', accountConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{accountEmail || t('remoteAccountEntryTitle')}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {accountConnected ? t('remoteAccountEntryConnected') : t('remoteAccountEntryDisconnected')}
                </p>
              </div>
            </div>
          </button>
        ) : null}
        {mode === 'main' && (
          <div className="mb-2">
            <NavLink
              to="/settings"
              className={({ isActive }) => cn(
                'group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-base',
                isActive
                  ? 'bg-gray-200 text-gray-900 font-semibold shadow-sm'
                  : 'text-gray-600 hover:bg-[#e4e7ef] hover:text-gray-900'
              )}
            >
              {({ isActive }) => (
                <>
                  <Settings className={cn('h-[17px] w-[17px] transition-colors', isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-800')} />
                  <span className="flex-1 text-left">{t('settings')}</span>
                </>
              )}
            </NavLink>
          </div>
        )}
        <div className="mb-2">
          <Select value={theme} onValueChange={(value) => handleThemeSwitch(value as UiTheme)}>
            <SelectTrigger className="w-full h-auto rounded-xl border-0 bg-transparent shadow-none px-3 py-2.5 text-[14px] font-medium text-gray-600 hover:bg-[#e4e7ef] focus:ring-0">
              <div className="flex items-center gap-3 min-w-0">
                <Palette className="h-[17px] w-[17px] text-gray-400" />
                <span className="text-left">{t('theme')}</span>
              </div>
              <span className="ml-auto text-xs text-gray-500">{currentThemeLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mb-2">
          <Select value={language} onValueChange={(value) => handleLanguageSwitch(value as I18nLanguage)}>
            <SelectTrigger className="w-full h-auto rounded-xl border-0 bg-transparent shadow-none px-3 py-2.5 text-[14px] font-medium text-gray-600 hover:bg-[#e4e7ef] focus:ring-0">
              <div className="flex items-center gap-3 min-w-0">
                <Languages className="h-[17px] w-[17px] text-gray-400" />
                <span className="text-left">{t('language')}</span>
              </div>
              <span className="ml-auto text-xs text-gray-500">{currentLanguageLabel}</span>
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          onClick={() => docBrowser.open(undefined, { kind: 'docs', newTab: true, title: 'Docs' })}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-base text-gray-600 hover:bg-[#e4e7ef] hover:text-gray-800"
        >
          <BookOpen className="h-[17px] w-[17px] text-gray-400" />
          <span className="flex-1 text-left">{t('docBrowserHelp')}</span>
        </button>
      </div>
    </aside>
  );
}
