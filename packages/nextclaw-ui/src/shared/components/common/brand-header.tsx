import type { UpdateSnapshot } from '@nextclaw/shared';
import { runtimeUpdateManager, useRuntimeUpdateStore } from '@/features/system-status';
import { useAppMeta } from '@/shared/hooks/use-config';
import { type ReactNode, useState } from 'react';
import { RuntimeStatusEntry } from '@/app/components/layout/runtime-status-entry';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';

type BrandHeaderProps = {
  className?: string;
  suffix?: ReactNode;
};

export function BrandHeader({ className, suffix }: BrandHeaderProps) {
  const { data } = useAppMeta();
  const productName = data?.name ?? 'NextClaw';
  const productVersion = data?.productVersion?.trim();
  const versionLabel = productVersion ? `v${productVersion}` : null;
  const resolvedSuffix = suffix ?? <RuntimeStatusEntry />;
  const shouldReserveMacWindowControls = typeof window !== 'undefined' && window.nextclawDesktop?.platform === 'darwin';

  return (
    <div className={cn(className ?? 'flex min-w-0 items-center gap-2', shouldReserveMacWindowControls && 'pl-[58px]')}>
      <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md">
        <img src="/logo.svg" alt={productName} className="h-full w-full object-contain" />
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span className="shrink-0 text-[14px] font-semibold text-gray-800">{productName}</span>
          {versionLabel ? <BrandVersionLabel versionLabel={versionLabel} /> : null}
        </div>
        <RuntimeUpdateInlineStatus />
        {resolvedSuffix ? <span className="inline-flex items-center shrink-0">{resolvedSuffix}</span> : null}
      </div>
    </div>
  );
}

function BrandVersionLabel({ versionLabel }: { versionLabel: string }) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  return (
    <span
      className="relative min-w-0 flex-1"
      onMouseEnter={() => setIsTooltipOpen(true)}
      onMouseLeave={() => setIsTooltipOpen(false)}
      onFocus={() => setIsTooltipOpen(true)}
      onBlur={() => setIsTooltipOpen(false)}
    >
      <span
        tabIndex={0}
        aria-label={versionLabel}
        className="block min-w-0 truncate text-[12px] font-medium text-gray-500 outline-none"
      >
        {versionLabel}
      </span>
      {isTooltipOpen ? (
        <span className="pointer-events-none absolute left-0 top-full z-[var(--z-tooltip)] mt-1 w-max max-w-none whitespace-nowrap rounded-md border bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-md">
          {versionLabel}
        </span>
      ) : null}
    </span>
  );
}

function RuntimeUpdateInlineStatus() {
  const { supported, busyAction, snapshot } = useRuntimeUpdateStore();
  if (!supported || !snapshot) {
    return null;
  }
  if (snapshot.status === 'downloading' || snapshot.status === 'blocked' || snapshot.status === 'failed') {
    return <RuntimeUpdateInlineBadge snapshot={snapshot} />;
  }
  if (snapshot.status === 'downloaded') {
    return (
      <button
        type="button"
        className="inline-flex h-5 shrink-0 items-center rounded-full bg-emerald-50 px-2 text-[11px] font-semibold leading-none text-emerald-700 ring-1 ring-emerald-100 transition-colors hover:bg-emerald-100 disabled:opacity-70"
        disabled={busyAction === 'applying'}
        onClick={() => void runtimeUpdateManager.applyDownloadedUpdate()}
      >
        {busyAction === 'applying' ? t('desktopUpdatesInlineApplying') : t('desktopUpdatesInlineReady')}
      </button>
    );
  }
  if (snapshot.status === 'update-available') {
    return (
      <button
        type="button"
        className="inline-flex h-5 shrink-0 items-center rounded-full bg-amber-50 px-2 text-[11px] font-semibold leading-none text-amber-700 ring-1 ring-amber-100 transition-colors hover:bg-amber-100 disabled:opacity-70"
        disabled={busyAction === 'downloading'}
        onClick={() => void runtimeUpdateManager.downloadUpdate()}
      >
        {busyAction === 'downloading' ? t('desktopUpdatesInlineDownloading') : t('desktopUpdatesInlineDownload')}
      </button>
    );
  }
  return null;
}

function RuntimeUpdateInlineBadge({ snapshot }: { snapshot: UpdateSnapshot }) {
  if (snapshot.status === 'blocked' || snapshot.status === 'failed') {
    return <RuntimeUpdateIssueIcon snapshot={snapshot} />;
  }
  const label = snapshot.status === 'downloading' ? resolveInlineDownloadLabel(snapshot) : null;
  if (!label) {
    return null;
  }
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center rounded-full bg-amber-50 px-2 text-[11px] font-semibold leading-none text-amber-700 ring-1 ring-amber-100 transition-colors hover:bg-amber-100 disabled:opacity-70"
      title={t('updates')}
    >
      {label}
    </span>
  );
}

function RuntimeUpdateIssueIcon({ snapshot }: { snapshot: UpdateSnapshot }) {
  const title = snapshot.status === 'failed' ? t('desktopUpdatesStatusFailed') : t('desktopUpdatesStatusBlocked');
  const recoveryCommand = snapshot.recoveryCommand?.trim() || null;
  const diagnostic = snapshot.errorMessage?.trim() || snapshot.blockReason?.trim() || null;
  const rootCause = snapshot.status === 'blocked' && snapshot.blockReason
    ? t(`desktopUpdatesBlockedRootCause.${snapshot.blockReason}`)
    : null;
  const tooltip = [title, rootCause, diagnostic, recoveryCommand].filter(Boolean).join('\n');
  return (
    <span
      role="img"
      aria-label={title}
      title={tooltip}
      tabIndex={0}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[13px] font-bold leading-none text-amber-700 ring-1 ring-amber-100"
    >
      !
    </span>
  );
}

function resolveInlineDownloadLabel(snapshot: UpdateSnapshot): string {
  const percent = snapshot.progress?.percent;
  return percent === null || percent === undefined
    ? t('desktopUpdatesInlineDownloading')
    : t('desktopUpdatesInlineDownloadingPercent').replace('{percent}', String(percent));
}
