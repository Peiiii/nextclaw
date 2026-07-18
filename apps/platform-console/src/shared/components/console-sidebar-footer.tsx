import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Props = {
  accountHref: string;
  accountLabel: string;
  currentUserMeta: string;
  currentUserName: string;
  languageLabel: string;
  localeSwitcher: ReactNode;
  logoutLabel: string;
  onLogout: () => void;
  themeLabel: string;
  themeSwitcher: ReactNode;
};

export function ConsoleSidebarFooter(props: Props): JSX.Element {
  const avatarLabel = props.currentUserName.trim().charAt(0).toUpperCase() || 'N';

  return (
    <div className="grid gap-1 sm:grid-cols-2 md:grid-cols-1">
      <NavLink
        to={props.accountHref}
        aria-label={props.accountLabel}
        className={({ isActive }) => cn(
          'group flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-[var(--color-surface)] focus-visible:ring-2 focus-visible:ring-brand-200',
          isActive ? 'bg-[var(--color-surface)] shadow-[0_1px_2px_rgba(31,31,29,0.06)]' : null
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white shadow-[0_1px_3px_rgba(31,31,29,0.14)]">
          {avatarLabel}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">{props.currentUserName}</span>
          <span className="mt-0.5 block truncate text-xs text-[var(--color-foreground-subtle)]">{props.currentUserMeta}</span>
        </span>
        <ChevronIcon />
      </NavLink>

      <PreferenceRow icon={<LanguageIcon />} label={props.languageLabel} control={props.localeSwitcher} />
      <PreferenceRow icon={<ThemeIcon />} label={props.themeLabel} control={props.themeSwitcher} />

      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--color-foreground-muted)] outline-none transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
        onClick={props.onLogout}
      >
        <LogoutIcon />
        <span>{props.logoutLabel}</span>
      </button>
    </div>
  );
}

function PreferenceRow(props: { control: ReactNode; icon: ReactNode; label: string }): JSX.Element {
  return (
    <div className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl px-3 text-[var(--color-foreground-muted)]">
      <span className="shrink-0 text-[var(--color-foreground-subtle)]">{props.icon}</span>
      <span className="min-w-0 flex-1 text-sm font-medium">{props.label}</span>
      <div className="shrink-0">{props.control}</div>
    </div>
  );
}

function LanguageIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="10" r="7" />
      <path d="M3.5 10h13M10 3c2 2 3 4.3 3 7s-1 5-3 7c-2-2-3-4.3-3-7s1-5 3-7Z" strokeLinecap="round" />
    </svg>
  );
}

function ThemeIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14.8 13.7A6.5 6.5 0 0 1 6.3 5.2 6.5 6.5 0 1 0 14.8 13.7Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" strokeLinecap="round" />
      <path d="M11 7l3 3-3 3M7 10h7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon(): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4 shrink-0 text-[var(--color-foreground-subtle)] transition-transform group-hover:translate-x-0.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="m8 6 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
