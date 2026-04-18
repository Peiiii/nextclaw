import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
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
import { UserSkillsPage } from '@/pages/user-skills-page';
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
          <Routes>
            <Route index element={<UserDashboardPage token={token} user={user} />} />
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

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return (
    <Routes>
      <Route path="/share/:grantToken" element={<SharePageRoute />} />
      <Route path="/*" element={<ConsoleWorkbench />} />
    </Routes>
  );
}
