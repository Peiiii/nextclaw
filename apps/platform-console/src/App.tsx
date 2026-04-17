import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMe } from '@/api/client';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createTranslator } from '@/i18n/i18n.service';
import { useLocaleStore } from '@/i18n/locale.store';
import { LoginPage } from '@/pages/LoginPage';
import { SharePage } from '@/pages/SharePage';
import { UserDashboardPage } from '@/pages/UserDashboardPage';
import { useAuthStore } from '@/store/auth';

const accountPaths = new Set(['/account', '/profile']);

function readAppLocationState(): {
  shareToken: string | null;
  highlightAccount: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      shareToken: null,
      highlightAccount: false
    };
  }
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const match = pathname.match(/^\/share\/([^/]+)$/);
  return {
    shareToken: match?.[1] ? decodeURIComponent(match[1]) : null,
    highlightAccount: accountPaths.has(pathname)
  };
}

export default function App(): JSX.Element {
  const { shareToken, highlightAccount } = readAppLocationState();
  const locale = useLocaleStore((state) => state.locale);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const t = useMemo(() => createTranslator(locale), [locale]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  if (shareToken) {
    return <SharePage grantToken={shareToken} />;
  }

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
    return <main className="p-6 text-sm text-slate-500">{t('app.loadingAccount')}</main>;
  }

  if (!meQuery.data?.user) {
    return (
      <main className="min-h-screen bg-transparent px-4 py-8 text-slate-900 md:px-8">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">{t('app.brand')}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            {t('app.accountLoadFailedTitle')}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
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
    <main className="min-h-screen bg-transparent text-slate-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-white/70 bg-white/85 px-5 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">{t('app.brand')}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <p className="text-lg font-semibold tracking-[-0.02em] text-slate-950">{user?.email ?? ''}</p>
              {user?.role ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
                  {t(`app.roles.${user.role}`)}
                </span>
              ) : null}
              {user.username ? (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium tracking-[0.08em] text-brand-700">
                  @{user.username}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav className="flex items-center gap-2">
              <a
                href="/"
                className={cn(
                  'inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition-colors',
                  highlightAccount
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    : 'border-slate-950 bg-slate-950 text-white hover:bg-slate-800'
                )}
              >
                {t('app.navigation.home')}
              </a>
              <a
                href="/account"
                className={cn(
                  'inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-sm font-medium transition-colors',
                  highlightAccount
                    ? 'border-slate-950 bg-slate-950 text-white hover:bg-slate-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                )}
              >
                {t('app.navigation.account')}
              </a>
            </nav>
            <LocaleSwitcher />
            <Button variant="ghost" className="rounded-2xl border border-slate-200 px-4" onClick={() => logout()}>
              {t('common.logout')}
            </Button>
          </div>
        </header>

        <UserDashboardPage token={token} user={user} highlightAccount={highlightAccount} />
      </div>
    </main>
  );
}
