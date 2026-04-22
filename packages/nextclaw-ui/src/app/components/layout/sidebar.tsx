import { cn } from '@/shared/lib/utils';
import { LANGUAGE_OPTIONS, t, type I18nLanguage } from '@/shared/lib/i18n';
import { THEME_OPTIONS, type UiTheme } from '@/shared/lib/theme';
import { Cpu, GitBranch, History, MessageCircle, MessageSquare, Sparkles, BookOpen, Plug, BrainCircuit, AlarmClock, Languages, Palette, KeyRound, Settings, ArrowLeft, Search, Shield, Wrench, Wifi, Bot, Download } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useDocBrowser } from '@/shared/components/doc-browser';
import { BrandHeader } from '@/shared/components/common/brand-header';
import { SidebarActionItem, SidebarNavLinkItem, SidebarSelectItem } from '@/app/components/layout/sidebar-items';
import { useI18n } from '@/app/components/providers/i18n-provider';
import { useTheme } from '@/app/components/providers/theme-provider';
import { SelectItem } from '@/shared/components/ui/select';
import { useAppManager } from '@/app/components/app-manager-provider';
import { useRemoteStatus } from '@/features/remote';

type SidebarMode = 'main' | 'settings';

type SidebarProps = {
  mode: SidebarMode;
};

export function Sidebar({ mode }: SidebarProps) {
  const manager = useAppManager();
  const docBrowser = useDocBrowser();
  const remoteStatus = useRemoteStatus();
  const { language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const isSettingsMode = mode === 'settings';
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
    },
    {
      target: '/agents',
      label: t('agentsPageTitle'),
      icon: Bot,
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
      target: '/channels',
      label: t('channels'),
      icon: MessageSquare,
    },
    {
      target: '/search',
      label: t('searchChannels'),
      icon: Search,
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
    },
    {
      target: '/runtime',
      label: t('runtime'),
      icon: GitBranch,
    },
    {
      target: '/updates',
      label: t('updates'),
      icon: Download,
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
    }
  ];
  const navItems = isSettingsMode ? settingsNavItems : mainNavItems;
  const sidebarDensity = isSettingsMode ? 'compact' : 'default';

  return (
    <aside className="w-[240px] shrink-0 flex h-full min-h-0 flex-col overflow-hidden bg-secondary px-4 py-6">
      {isSettingsMode ? (
        <div className="shrink-0 px-2 pb-3">
          <div
            className="flex items-center gap-2 px-1 py-1"
            data-testid="settings-sidebar-header"
          >
            <NavLink
              to="/chat"
              className="group inline-flex min-w-0 items-center gap-1.5 rounded-lg px-1 py-1 text-[12px] font-medium text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-gray-900"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-gray-700" />
              <span className="truncate">{t('backToMain')}</span>
            </NavLink>
            <span className="h-4 w-px shrink-0 bg-[#dddfe6]" aria-hidden="true" />
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-gray-800">{t('settings')}</h1>
          </div>
        </div>
      ) : (
        <div className="shrink-0 px-2 pb-8">
          <BrandHeader className="flex items-center gap-2.5 cursor-pointer" />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Navigation */}
        <nav className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
          <ul className={cn(isSettingsMode ? 'space-y-0.5 pb-3' : 'space-y-1 pb-4')}>
            {navItems.map((item) => {
              return (
                <li key={item.target}>
                  <SidebarNavLinkItem
                    to={item.target}
                    label={item.label}
                    icon={item.icon}
                    density={sidebarDensity}
                  />
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer actions stay reachable while the nav scrolls independently. */}
        <div className={cn('shrink-0 border-t border-[#dde0ea] bg-secondary', isSettingsMode ? 'mt-2 pt-3' : 'mt-3 pt-3')}>
          {isSettingsMode ? (
            <SidebarActionItem
              onClick={() => manager.accountManager.openAccountPanel()}
              icon={KeyRound}
              label={t('remoteAccountEntryManage')}
              density="compact"
              className="mb-1.5"
              trailing={accountConnected ? accountEmail || t('remoteAccountEntryConnected') : t('remoteAccountEntryDisconnected')}
              trailingClassName="max-w-[92px] truncate text-right"
              testId="settings-sidebar-account-entry"
              trailingTestId="settings-sidebar-account-status"
            />
          ) : null}
          {mode === 'main' && (
            <div className="mb-2">
              <SidebarNavLinkItem
                to="/settings"
                label={t('settings')}
                icon={Settings}
              />
            </div>
          )}
          <div className="mb-2">
            <SidebarSelectItem
              value={theme}
              onValueChange={(value) => handleThemeSwitch(value as UiTheme)}
              icon={Palette}
              label={t('theme')}
              valueLabel={currentThemeLabel}
              density={sidebarDensity}
            >
              {THEME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SidebarSelectItem>
          </div>
          <div className="mb-2">
            <SidebarSelectItem
              value={language}
              onValueChange={(value) => handleLanguageSwitch(value as I18nLanguage)}
              icon={Languages}
              label={t('language')}
              valueLabel={currentLanguageLabel}
              density={sidebarDensity}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SidebarSelectItem>
          </div>
          <SidebarActionItem
            onClick={() => docBrowser.open(undefined, { kind: 'docs', newTab: true, title: 'Docs' })}
            icon={BookOpen}
            label={t('docBrowserHelp')}
            density={sidebarDensity}
          />
        </div>
      </div>
    </aside>
  );
}
