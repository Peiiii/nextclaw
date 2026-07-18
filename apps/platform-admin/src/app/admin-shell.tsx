import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AdminConsoleRoute, AdminConsoleRouteKey } from '@/pages/admin-console-navigation';

type Props = {
  routes: AdminConsoleRoute[];
  currentRoute: AdminConsoleRoute;
  currentUserEmail: string;
  onLogout: () => void;
  children: ReactNode;
};

export function AdminShell({
  routes,
  currentRoute,
  currentUserEmail,
  onLogout,
  children
}: Props): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white md:flex-row md:rounded-[24px] md:border md:border-[#e4e0d7] md:shadow-[0_20px_60px_rgba(31,31,29,0.08)]">
      <header data-testid="admin-mobile-header" className="relative z-40 flex h-14 shrink-0 items-center justify-between border-b border-[#e4e0d7] bg-white px-4 md:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8f8a7d]">NextClaw Admin</p>
          <h1 className="truncate text-sm font-semibold tracking-[-0.01em] text-[#1f1f1d]">{currentRoute.label}</h1>
        </div>
        <AdminMobileAccount currentUserEmail={currentUserEmail} onLogout={onLogout} />
      </header>

      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[#e4e0d7] bg-[#f3f2ee] md:flex">
        <div className="shrink-0 border-b border-[#e4e0d7] px-4 py-2.5 md:px-5 md:py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f8a7d]">NextClaw</p>
          <h1 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-[#1f1f1d] md:mt-2 md:text-[17px]">Platform Admin</h1>
        </div>

        <AdminNavigation routes={routes} currentRoute={currentRoute} variant="desktop" />

        <div className="shrink-0 border-t border-[#e4e0d7] px-4 py-4">
          <div className="rounded-2xl border border-[#e4e0d7] bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f8a7d]">Admin</p>
            <p className="mt-2 truncate text-sm font-medium text-[#1f1f1d]">{currentUserEmail}</p>
            <Button variant="ghost" className="mt-3 h-9 w-full justify-start px-2 text-[#656561]" onClick={onLogout}>
              退出登录
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f9f8f5]">
        <header className="sticky top-0 z-10 hidden shrink-0 border-b border-[#e4e0d7] bg-[rgba(249,248,245,0.94)] backdrop-blur md:block">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:px-4 sm:py-3 md:px-8 md:py-4">
            <div className="min-w-0">
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f8a7d] sm:block">Platform Governance</p>
              <h2 className="truncate text-base font-semibold tracking-[-0.02em] text-[#1f1f1d] sm:mt-1 sm:text-xl">{currentRoute.label}</h2>
              <p className="mt-1 hidden truncate text-sm text-[#656561] sm:block">{currentRoute.description}</p>
            </div>

            <div className="hidden shrink-0 items-center gap-3 sm:flex">
              <span className="rounded-full border border-[#ddd7c8] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f8a7d]">
                production
              </span>
              <div className="hidden text-right lg:block">
                <p className="text-xs font-medium text-[#1f1f1d]">{currentUserEmail}</p>
                <p className="text-xs text-[#8f8a7d]">管理员</p>
              </div>
            </div>
          </div>
        </header>

        <main data-testid="admin-scroll-region" className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          <div className="mx-auto w-full max-w-[1440px] px-3 py-3 sm:px-6 sm:py-5 lg:px-8 lg:py-6">{children}</div>
        </main>
        <AdminNavigation routes={routes} currentRoute={currentRoute} variant="mobile" />
      </div>
    </div>
  );
}

function AdminMobileAccount(props: { currentUserEmail: string; onLogout: () => void }): JSX.Element {
  return (
    <details className="group relative">
      <summary aria-label="管理员账号" className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full outline-none transition-colors hover:bg-[#f3f2ee] focus-visible:ring-2 focus-visible:ring-brand-200 [&::-webkit-details-marker]:hidden">
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">A</span>
      </summary>
      <div className="absolute right-0 top-[calc(100%+8px)] w-[min(300px,calc(100vw-24px))] rounded-2xl border border-[#e4e0d7] bg-white p-2 shadow-[0_18px_48px_rgba(31,31,29,0.18)]">
        <p className="truncate border-b border-[#eeeae1] px-3 py-2.5 text-sm font-medium text-[#1f1f1d]">{props.currentUserEmail}</p>
        <Button variant="ghost" className="mt-1 h-10 w-full justify-start px-3 text-[#656561]" onClick={props.onLogout}>退出登录</Button>
      </div>
    </details>
  );
}

function AdminNavigation(props: {
  routes: AdminConsoleRoute[];
  currentRoute: AdminConsoleRoute;
  variant: 'desktop' | 'mobile';
}): JSX.Element {
  if (props.variant === 'mobile') {
    return (
      <nav data-testid="admin-mobile-navigation" className="shrink-0 border-t border-[#e4e0d7] bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {props.routes.map((route) => {
            const isActive = route.key === props.currentRoute.key;
            return (
              <li key={route.key} className="min-w-0">
                <a
                  href={route.hash}
                  className={cn(
                    'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-200',
                    isActive ? 'text-brand-700' : 'text-[#8f8a7d]'
                  )}
                >
                  <AdminNavigationIcon routeKey={route.key} isActive={isActive} />
                  <span className="w-full truncate text-center">{adminMobileRouteLabel(route.key)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1.5">
        {props.routes.map((route) => {
          const isActive = route.key === props.currentRoute.key;
          return (
            <li key={route.key}>
              <a
                href={route.hash}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white text-[#1f1f1d] shadow-[0_1px_2px_rgba(31,31,29,0.05)]'
                    : 'text-[#656561] hover:bg-white/70 hover:text-[#1f1f1d]'
                )}
              >
                <AdminNavigationIcon routeKey={route.key} isActive={isActive} />
                <span className="truncate">{route.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function adminMobileRouteLabel(routeKey: AdminConsoleRouteKey): string {
  if (routeKey === 'overview') {
    return '总览';
  }
  if (routeKey === 'marketplace') {
    return 'Skills';
  }
  if (routeKey === 'marketplace-apps') {
    return 'Apps';
  }
  if (routeKey === 'users') {
    return '用户';
  }
  return '充值';
}

function AdminNavigationIcon(props: { routeKey: AdminConsoleRouteKey; isActive: boolean }): JSX.Element {
  const className = cn('size-4 shrink-0', props.isActive ? 'text-brand-600' : 'text-[#aaa394]');
  if (props.routeKey === 'overview') {
    return <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 10 10 3l7 7v7H3v-7Z" strokeLinejoin="round" /><path d="M8 17v-5h4v5" /></svg>;
  }
  if (props.routeKey === 'marketplace' || props.routeKey === 'marketplace-apps') {
    return <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M7 8h6M7 12h4" strokeLinecap="round" /></svg>;
  }
  if (props.routeKey === 'users') {
    return <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="10" cy="7" r="3" /><path d="M4.5 16c.7-2.6 2.5-4 5.5-4s4.8 1.4 5.5 4" strokeLinecap="round" /></svg>;
  }
  return <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 6h12v9H4z" /><path d="M6 6V4h8v2M7 10h6" strokeLinecap="round" /></svg>;
}
