import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { fetchMe } from '@/api/client';
import { ConsoleShell } from '@/app/console-shell';
import { UserAccountPage } from '@/features/account';
import { LoginPage } from '@/features/auth';
import { UserDashboardPage, UserUsagePage } from '@/features/dashboard';
import { UserAppsPage, UserSkillsPage } from '@/features/marketplace';
import { ThemeSwitcher, useThemeStore } from '@/features/preferences';
import { SharePage } from '@/features/remote-access';
import { createTranslator } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';
import { getUserConsoleRoutes, resolveUserConsoleRoute } from '@/app/user-console-navigation.config';
import { Button } from '@/shared/components/button';
import { LocaleSwitcher } from '@/shared/components/locale-switcher';
import { useAuthStore } from '@/store/auth';

function SharePageRoute(): JSX.Element {
  const params = useParams<{ grantToken: string }>();

  if (!params.grantToken) {
    return <Navigate to="/" replace />;
  }

  return <SharePage grantToken={params.grantToken} />;
}

function ConsoleWorkbench(): JSX.Element {
  const location = useLocation();
  const locale = useLocaleStore((state) => state.locale);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const routes = useMemo(() => getUserConsoleRoutes(t), [t]);
  const currentRoute = useMemo(
    () => resolveUserConsoleRoute(location.pathname, routes),
    [location.pathname, routes]
  );

  const meQuery = useQuery({
    queryKey: ['me', token],
    queryFn: async () => {
      if (!token) {
        throw new Error('No token');
      }
      return await fetchMe(token);
    },
    enabled: Boolean(token)
  });

  if (!token) {
    return <LoginPage />;
  }

  if (meQuery.isLoading) {
    return <main className="p-6 text-sm text-[var(--color-foreground-subtle)]">{t('app.loadingAccount')}</main>;
  }

  if (!meQuery.data?.user) {
    return (
      <main className="min-h-screen bg-[var(--color-canvas)] px-4 py-8 text-[var(--color-foreground)] md:px-8">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_18px_48px_rgba(31,31,29,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700 dark:text-brand-300">{t('app.brand')}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
            {t('app.accountLoadFailedTitle')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-foreground-muted)]">
            {meQuery.error instanceof Error ? meQuery.error.message : t('app.accountLoadFailedDescription')}
          </p>
          <Button className="mt-5 rounded-2xl px-5" onClick={() => logout()}>
            {t('app.accountLoadFailedAction')}
          </Button>
        </div>
      </main>
    );
  }

  const user = meQuery.data.user;

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-foreground)]">
      <div className="mx-auto w-full max-w-[1680px] px-4 py-4 md:px-5 xl:px-6">
        <ConsoleShell
          shellLabel={t('app.workbenchTag')}
          routes={routes}
          currentRoute={currentRoute}
          currentUserMeta={user.username ? user.email : t(`app.roles.${user.role}`)}
          currentUserName={user.username ?? user.email}
          accountLabel={t('app.navigation.account')}
          languageLabel={t('common.languageLabel')}
          logoutLabel={t('common.logout')}
          localeSwitcher={<LocaleSwitcher variant="sidebar" />}
          onLogout={logout}
          themeLabel={t('common.themeLabel')}
          themeSwitcher={<ThemeSwitcher />}
        >
          <Routes>
            <Route index element={<UserDashboardPage token={token} />} />
            <Route path="usage" element={<UserUsagePage token={token} user={user} />} />
            <Route path="apps" element={<UserAppsPage token={token} t={t} />} />
            <Route path="skills" element={<UserSkillsPage token={token} t={t} />} />
            <Route path="account" element={<UserAccountPage token={token} user={user} t={t} />} />
            <Route path="profile" element={<Navigate to="/account" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ConsoleShell>
      </div>
    </main>
  );
}

export default function App(): JSX.Element {
  const locale = useLocaleStore((state) => state.locale);
  const themePreference = useThemeStore((state) => state.preference);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (): void => {
      const isDark = themePreference === 'dark' || (themePreference === 'system' && mediaQuery.matches);
      document.documentElement.classList.toggle('dark', isDark);
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [themePreference]);

  return (
    <Routes>
      <Route path="/share/:grantToken" element={<SharePageRoute />} />
      <Route path="/*" element={<ConsoleWorkbench />} />
    </Routes>
  );
}
