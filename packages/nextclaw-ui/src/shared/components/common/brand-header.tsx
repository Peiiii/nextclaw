import type { UpdateSnapshot } from '@nextclaw/kernel';
import { runtimeUpdateManager, useRuntimeUpdateStore } from '@/features/system-status';
import { useAppMeta } from '@/shared/hooks/use-config';
import { type ReactNode, useState } from 'react';
import { RuntimeStatusEntry } from '@/app/components/layout/runtime-status-entry';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';

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

  return (
    <div className={className ?? 'flex items-center gap-2.5'}>
      <div className="h-7 w-7 rounded-lg overflow-hidden flex items-center justify-center">
        <img src="/logo.svg" alt={productName} className="h-full w-full object-contain" />
      </div>
      <div className="flex min-w-0 items-baseline gap-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="shrink-0 text-[15px] font-semibold tracking-[-0.01em] text-gray-800">{productName}</span>
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
        className="block min-w-0 truncate text-[13px] font-medium text-gray-500 outline-none"
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
        className={cn(
          'inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold leading-none ring-1 transition-colors',
          resolveInlineUpdateTone(snapshot.status)
        )}
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
        className={cn(
          'inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold leading-none ring-1 transition-colors',
          resolveInlineUpdateTone(snapshot.status)
        )}
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
  const label = resolveInlineUpdateLabel(snapshot);
  if (!label) {
    return null;
  }
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-semibold leading-none ring-1 transition-colors',
        resolveInlineUpdateTone(snapshot.status)
      )}
      title={t('updates')}
    >
      {label}
    </span>
  );
}

function resolveInlineUpdateLabel(snapshot: UpdateSnapshot): string | null {
  if (snapshot.status === 'downloading') {
    const percent = snapshot.progress?.percent;
    return percent === null || percent === undefined
      ? t('desktopUpdatesInlineDownloading')
      : t('desktopUpdatesInlineDownloadingPercent').replace('{percent}', String(percent));
  }
  if (snapshot.status === 'downloaded') {
    return t('desktopUpdatesInlineReady');
  }
  if (snapshot.status === 'update-available') {
    return t('desktopUpdatesInlineDownload');
  }
  if (snapshot.status === 'blocked' || snapshot.status === 'failed') {
    return t('desktopUpdatesInlineAttention');
  }
  return null;
}

function resolveInlineUpdateTone(status: UpdateSnapshot['status']): string {
  if (status === 'downloaded') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100 hover:bg-emerald-100 disabled:opacity-70';
  }
  if (status === 'blocked' || status === 'failed') {
    return 'bg-red-50 text-red-700 ring-red-100';
  }
  return 'bg-amber-50 text-amber-700 ring-amber-100 hover:bg-amber-100 disabled:opacity-70';
}
