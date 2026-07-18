import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { UserConsoleRoute } from '@/pages/user-console-navigation';

type Props = {
  shellLabel: string;
  routes: UserConsoleRoute[];
  currentRoute: UserConsoleRoute;
  currentUserEmail: string;
  currentUserRoleLabel: string;
  localeSwitcher: ReactNode;
  onLogout: () => void;
  children: ReactNode;
};

export function ConsoleShell({
  shellLabel,
  routes,
  currentRoute,
  currentUserEmail,
  currentUserRoleLabel,
  localeSwitcher,
  onLogout,
  children
}: Props): JSX.Element {
  return (
    <div className="flex h-[calc(100vh-32px)] min-h-[720px] flex-col overflow-hidden rounded-[24px] border border-[#e4e0d7] bg-white shadow-[0_20px_60px_rgba(31,31,29,0.08)] md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-[#e4e0d7] bg-[#f3f2ee] md:w-[248px] md:border-b-0 md:border-r">
        <div className="shrink-0 border-b border-[#e4e0d7] px-4 py-3 md:px-5 md:py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f8a7d]">NextClaw</p>
          <h1 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-[#1f1f1d] md:mt-2 md:text-[17px]">Platform</h1>
        </div>

        <nav className="shrink-0 overflow-x-auto px-3 py-2 md:flex-1 md:overflow-y-auto md:py-4">
          <ul className="flex gap-1.5 md:block md:space-y-1.5">
            {routes.map((route) => (
              <li key={route.key} className="shrink-0">
                <NavLink
                  to={route.href}
                  end={route.href === '/'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-white text-[#1f1f1d] shadow-[0_1px_2px_rgba(31,31,29,0.05)]'
                        : 'text-[#656561] hover:bg-white/70 hover:text-[#1f1f1d]'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          'h-2.5 w-2.5 shrink-0 rounded-full',
                          isActive ? 'bg-brand-500' : 'bg-[#c9c3b5]'
                        )}
                      />
                      <span className="whitespace-nowrap md:truncate">{route.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden shrink-0 border-t border-[#e4e0d7] px-4 py-4 md:block">
          <div className="rounded-2xl border border-[#e4e0d7] bg-white px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8f8a7d]">Account</p>
            <p className="mt-2 truncate text-sm font-medium text-[#1f1f1d]">{currentUserEmail}</p>
            <p className="mt-1 text-xs text-[#8f8a7d]">{currentUserRoleLabel}</p>
            <div className="mt-3">{localeSwitcher}</div>
            <Button variant="ghost" className="mt-3 h-9 w-full justify-start px-2 text-[#656561]" onClick={onLogout}>
              退出登录
            </Button>
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 border-t border-[#e4e0d7] px-3 py-2 md:hidden">
          <p className="min-w-0 flex-1 truncate text-xs font-medium text-[#656561]">{currentUserEmail}</p>
          <div className="shrink-0">{localeSwitcher}</div>
          <Button variant="ghost" className="h-8 shrink-0 px-2 text-xs text-[#656561]" onClick={onLogout}>
            退出登录
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[#f9f8f5]">
        <header className="sticky top-0 z-10 shrink-0 border-b border-[#e4e0d7] bg-[rgba(249,248,245,0.94)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 px-4 py-3 md:px-8 md:py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8f8a7d]">{shellLabel}</p>
              <h2 className="mt-1 truncate text-xl font-semibold tracking-[-0.02em] text-[#1f1f1d]">{currentRoute.label}</h2>
              <p className="mt-1 truncate text-sm text-[#656561]">{currentRoute.description}</p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full border border-[#ddd7c8] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8f8a7d]">
                production
              </span>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-[#1f1f1d]">{currentUserEmail}</p>
                <p className="text-xs text-[#8f8a7d]">{currentUserRoleLabel}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
