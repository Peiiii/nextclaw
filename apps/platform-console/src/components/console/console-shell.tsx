import type { ReactNode } from 'react';
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
    <div className="flex h-[calc(100vh-32px)] min-h-[720px] overflow-hidden rounded-[24px] border border-[#e4e0d7] bg-white shadow-[0_20px_60px_rgba(31,31,29,0.08)]">
      <aside className="flex w-[248px] shrink-0 flex-col border-r border-[#e4e0d7] bg-[#f3f2ee]">
        <div className="shrink-0 border-b border-[#e4e0d7] px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8f8a7d]">NextClaw</p>
          <h1 className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-[#1f1f1d]">Platform</h1>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1.5">
            {routes.map((route) => {
              const isActive = route.key === currentRoute.key;
              return (
                <li key={route.key}>
                  <a
                    href={route.href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-white text-[#1f1f1d] shadow-[0_1px_2px_rgba(31,31,29,0.05)]'
                        : 'text-[#656561] hover:bg-white/70 hover:text-[#1f1f1d]'
                    )}
                  >
                    <span
                      className={cn(
                        'h-2.5 w-2.5 shrink-0 rounded-full',
                        isActive ? 'bg-brand-500' : 'bg-[#c9c3b5]'
                      )}
                    />
                    <span className="truncate">{route.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-[#e4e0d7] px-4 py-4">
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[#f9f8f5]">
        <header className="sticky top-0 z-10 shrink-0 border-b border-[#e4e0d7] bg-[rgba(249,248,245,0.94)] backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-8 py-4">
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
          <div className="mx-auto w-full max-w-[1440px] px-6 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
