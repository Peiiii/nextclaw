import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '@/api/client';
import { ConsoleShell } from '@/components/console/console-shell';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { createTranslator } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';
import { LoginPage } from '@/pages/LoginPage';
import { SharePage } from '@/pages/SharePage';
import { UserDashboardPage } from '@/pages/UserDashboardPage';
import { UserAccountPage } from '@/pages/user-account-page';
import { getUserConsoleRoutes, resolveUserConsoleRoute } from '@/pages/user-console-navigation';
import { useAuthStore } from '@/store/auth';

function readAppLocationState(): {
  shareToken: string | null;
  pathname: string;
} {
  if (typeof window === 'undefined') {
    return {
      shareToken: null,
      pathname: '/'
    };
  }
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const match = pathname.match(/^\/share\/([^/]+)$/);
  return {
    shareToken: match?.[1] ? decodeURIComponent(match[1]) : null,
    pathname
  };
}

export default function App(): JSX.Element {
  const { shareToken, pathname } = readAppLocationState();
  const locale = useLocaleStore((state) => state.locale);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const t = useMemo(() => createTranslator(locale), [locale]);
  const routes = getUserConsoleRoutes(t);
  const currentRoute = resolveUserConsoleRoute(pathname, routes);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  if (shareToken) {
    return <SharePage grantToken={shareToken} />;
  }

  const meQuery = useQuery({
    queryKey: ['me', token, shareToken],
    queryFn: async () => {
      if (!token) {
        throw new Error('No token');
      }
      return await fetchMe(token);
    },
    enabled: Boolean(token) && !shareToken
  });

  if (!token) {
    return <LoginPage />;
  }

  if (meQuery.isLoading) {
    return <main className="p-6 text-sm text-[#8f8a7d]">{t('app.loadingAccount')}</main>;
  }

  if (!meQuery.data?.user) {
    return (
      <main className="min-h-screen bg-[#f9f8f5] px-4 py-8 text-[#1f1f1d] md:px-8">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-[#e4e0d7] bg-white p-6 shadow-[0_18px_48px_rgba(31,31,29,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">{t('app.brand')}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#1f1f1d]">
            {t('app.accountLoadFailedTitle')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#656561]">
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
    <main className="min-h-screen bg-[#f9f8f5] text-[#1f1f1d]">
      <div className="mx-auto w-full max-w-[1680px] px-4 py-4 md:px-5 xl:px-6">
        <ConsoleShell
          shellLabel={t('app.workbenchTag')}
          routes={routes}
          currentRoute={currentRoute}
          currentUserEmail={user.email}
          currentUserRoleLabel={t(`app.roles.${user.role}`)}
          localeSwitcher={<LocaleSwitcher />}
          onLogout={logout}
        >
          {currentRoute.key === 'account' ? (
            <UserAccountPage token={token} user={user} t={t} />
          ) : (
            <UserDashboardPage token={token} user={user} />
          )}
        </ConsoleShell>
      </div>
    </main>
  );
}
