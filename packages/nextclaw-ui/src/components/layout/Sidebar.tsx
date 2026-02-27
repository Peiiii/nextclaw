import { cn } from '@/lib/utils';
import { LANGUAGE_OPTIONS, t, type I18nLanguage } from '@/lib/i18n';
import { THEME_OPTIONS, type UiTheme } from '@/lib/theme';
import { Cpu, GitBranch, History, MessageCircle, MessageSquare, Sparkles, BookOpen, Plug, BrainCircuit, AlarmClock, Languages, Palette, KeyRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useDocBrowser } from '@/components/doc-browser';
import { useI18n } from '@/components/providers/I18nProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';

export function Sidebar() {
  const docBrowser = useDocBrowser();
  const { language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const currentLanguageLabel = LANGUAGE_OPTIONS.find((option) => option.value === language)?.label ?? language;
  const currentThemeLabel = t(THEME_OPTIONS.find((option) => option.value === theme)?.labelKey ?? 'themeWarm');

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

  const navItems = [
    {
      target: '/chat',
      label: t('chat'),
      icon: MessageCircle,
    },
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
      target: '/runtime',
      label: t('runtime'),
      icon: GitBranch,
    },
    {
      target: '/sessions',
      label: t('sessions'),
      icon: History,
    },
    {
      target: '/cron',
      label: t('cron'),
      icon: AlarmClock,
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
      target: '/marketplace/skills',
      label: t('marketplaceFilterSkills'),
      icon: BrainCircuit,
    }
  ];

  return (
    <aside className="w-[240px] shrink-0 flex flex-col h-full py-6 px-4 bg-secondary">
      {/* Logo Area */}
      <div className="px-2 mb-8">
        <div className="flex items-center gap-2.5 cursor-pointer">
          <div className="h-7 w-7 rounded-lg overflow-hidden flex items-center justify-center">
            <img src="/logo.svg" alt="NextClaw" className="h-full w-full object-contain" />
          </div>
          <span className="text-[15px] font-semibold text-gray-800 tracking-[-0.01em]">NextClaw</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1">
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
          onClick={() => docBrowser.open()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-base text-gray-600 hover:bg-[#e4e7ef] hover:text-gray-800"
        >
          <BookOpen className="h-[17px] w-[17px] text-gray-400" />
          <span className="flex-1 text-left">{t('docBrowserHelp')}</span>
        </button>
      </div>
    </aside>
  );
}
