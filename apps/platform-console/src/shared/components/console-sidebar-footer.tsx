import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Props = {
  variant: 'desktop' | 'mobile';
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

  if (props.variant === 'mobile') {
    return (
      <details className="group relative">
        <summary aria-label={props.accountLabel} className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full outline-none transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:ring-2 focus-visible:ring-brand-200 [&::-webkit-details-marker]:hidden">
          <Avatar label={avatarLabel} />
        </summary>
        <div className="absolute right-0 top-[calc(100%+8px)] max-h-[calc(100dvh-132px)] w-[min(320px,calc(100vw-24px))] space-y-1 overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[0_18px_48px_rgba(31,31,29,0.18)]">
          <div className="mb-1 flex min-w-0 items-center gap-3 border-b border-[var(--color-border)] px-3 py-2.5">
            <AccountIdentity name={props.currentUserName} meta={props.currentUserMeta} />
          </div>
          <MobileAccountLink href={props.accountHref} label={props.accountLabel} />
          <PreferenceRow icon={<LanguageIcon />} label={props.languageLabel} control={props.localeSwitcher} />
          <PreferenceRow icon={<ThemeIcon />} label={props.themeLabel} control={props.themeSwitcher} />
          <LogoutButton label={props.logoutLabel} onLogout={props.onLogout} />
        </div>
      </details>
    );
  }

  return (
    <div className="grid gap-1">
      <AccountLink {...props} avatarLabel={avatarLabel} />
      <PreferenceRow icon={<LanguageIcon />} label={props.languageLabel} control={props.localeSwitcher} />
      <PreferenceRow icon={<ThemeIcon />} label={props.themeLabel} control={props.themeSwitcher} />
      <LogoutButton label={props.logoutLabel} onLogout={props.onLogout} />
    </div>
  );
}

function MobileAccountLink({ href, label }: { href: string; label: string }): JSX.Element {
  return (
    <NavLink
      to={href}
      className={({ isActive }) => cn(
        'group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--color-foreground-muted)] outline-none transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-foreground)] focus-visible:ring-2 focus-visible:ring-brand-200',
        isActive ? 'bg-[var(--color-surface)] text-[var(--color-foreground)]' : null
      )}
    >
      <AccountIcon />
      <span className="flex-1">{label}</span>
      <ChevronIcon />
    </NavLink>
  );
}

function AccountLink(props: Props & { avatarLabel: string }): JSX.Element {
  return (
    <NavLink
      to={props.accountHref}
      aria-label={props.accountLabel}
      className={({ isActive }) => cn(
        'group flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-[var(--color-surface)] focus-visible:ring-2 focus-visible:ring-brand-200',
        isActive ? 'bg-[var(--color-surface)] shadow-[0_1px_2px_rgba(31,31,29,0.06)]' : null
      )}
    >
      <Avatar label={props.avatarLabel} />
      <AccountIdentity name={props.currentUserName} meta={props.currentUserMeta} />
      <ChevronIcon />
    </NavLink>
  );
}

function Avatar({ label }: { label: string }): JSX.Element {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white shadow-[0_1px_3px_rgba(31,31,29,0.14)]">
      {label}
    </span>
  );
}

function AccountIdentity({ name, meta }: { name: string; meta: string }): JSX.Element {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">{name}</span>
      <span className="mt-0.5 block truncate text-xs text-[var(--color-foreground-subtle)]">{meta}</span>
    </span>
  );
}

function LogoutButton({ label, onLogout }: { label: string; onLogout: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-[var(--color-foreground-muted)] outline-none transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
      onClick={onLogout}
    >
      <LogoutIcon />
      <span>{label}</span>
    </button>
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

function AccountIcon(): JSX.Element {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="10" cy="7" r="3" />
      <path d="M4.5 16c.7-2.6 2.5-4 5.5-4s4.8 1.4 5.5 4" strokeLinecap="round" />
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

function ChevronIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={cn('size-4 shrink-0 text-[var(--color-foreground-subtle)] transition-transform group-hover:translate-x-0.5', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="m8 6 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
