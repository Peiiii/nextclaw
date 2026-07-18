import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { ConsoleSidebarFooter } from '@/shared/components/console-sidebar-footer';
import { cn } from '@/lib/utils';
import type { UserConsoleRoute, UserConsoleRouteKey } from '@/app/user-console-navigation.config';

type Props = {
  shellLabel: string;
  routes: UserConsoleRoute[];
  currentRoute: UserConsoleRoute;
  currentUserMeta: string;
  currentUserName: string;
  accountLabel: string;
  languageLabel: string;
  logoutLabel: string;
  localeSwitcher: ReactNode;
  onLogout: () => void;
  themeLabel: string;
  themeSwitcher: ReactNode;
  children: ReactNode;
};

export function ConsoleShell({
  shellLabel,
  routes,
  currentRoute,
  currentUserMeta,
  currentUserName,
  accountLabel,
  languageLabel,
  logoutLabel,
  localeSwitcher,
  onLogout,
  themeLabel,
  themeSwitcher,
  children
}: Props): JSX.Element {
  return (
    <div className="flex h-[calc(100vh-32px)] min-h-[720px] flex-col overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_60px_rgba(31,31,29,0.08)] md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] md:w-[248px] md:border-b-0 md:border-r">
        <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3 md:px-5 md:py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-foreground-subtle)]">NextClaw</p>
          <h1 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-[var(--color-foreground)] md:mt-2 md:text-[17px]">Platform</h1>
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
                        ? 'bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-[0_1px_2px_rgba(31,31,29,0.05)]'
                        : 'text-[var(--color-foreground-muted)] hover:bg-[var(--color-surface)]/70 hover:text-[var(--color-foreground)]'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <ConsoleNavigationIcon routeKey={route.key} isActive={isActive} />
                      <span className="whitespace-nowrap md:truncate">{route.label}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="relative z-20 shrink-0 border-t border-[var(--color-border)] px-3 py-2 md:py-3">
          <ConsoleSidebarFooter
            accountHref="/account"
            accountLabel={accountLabel}
            currentUserMeta={currentUserMeta}
            currentUserName={currentUserName}
            languageLabel={languageLabel}
            localeSwitcher={localeSwitcher}
            logoutLabel={logoutLabel}
            onLogout={onLogout}
            themeLabel={themeLabel}
            themeSwitcher={themeSwitcher}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--color-canvas)]">
        <header className="sticky top-0 z-10 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-canvas)]">
          <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-3 px-4 py-3 md:px-8 md:py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-foreground-subtle)]">{shellLabel}</p>
              <h2 className="mt-1 truncate text-xl font-semibold tracking-[-0.02em] text-[var(--color-foreground)]">{currentRoute.label}</h2>
              <p className="mt-1 truncate text-sm text-[var(--color-foreground-muted)]">{currentRoute.description}</p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-foreground-subtle)]">
                production
              </span>
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

function ConsoleNavigationIcon(props: { routeKey: UserConsoleRouteKey; isActive: boolean }): JSX.Element {
  const className = cn('size-4 shrink-0', props.isActive ? 'text-brand-600' : 'text-[var(--color-icon-subtle)]');

  if (props.routeKey === 'instances') {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="14" height="10" rx="2" />
        <path d="M7 17h6M10 14v3" strokeLinecap="round" />
      </svg>
    );
  }

  if (props.routeKey === 'usage') {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 16V9M10 16V4M16 16v-5" strokeLinecap="round" />
      </svg>
    );
  }

  if (props.routeKey === 'apps') {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="3" width="5" height="5" rx="1" />
        <rect x="12" y="3" width="5" height="5" rx="1" />
        <rect x="3" y="12" width="5" height="5" rx="1" />
        <rect x="12" y="12" width="5" height="5" rx="1" />
      </svg>
    );
  }

  if (props.routeKey === 'skills') {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="m10 2 1.4 4.6L16 8l-4.6 1.4L10 14l-1.4-4.6L4 8l4.6-1.4L10 2Z" strokeLinejoin="round" />
        <path d="m15.5 13 .7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3Z" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="7" r="3" />
      <path d="M4.5 16c.7-2.6 2.5-4 5.5-4s4.8 1.4 5.5 4" strokeLinecap="round" />
    </svg>
  );
}
