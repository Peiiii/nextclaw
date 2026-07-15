import type { UpdateSnapshot } from '@nextclaw/shared';
import {
  runtimeUpdateManager,
  resolveUpdateReleaseNotesLink,
  useCurrentVersionReleaseNotesLink,
  useRuntimeUpdateStore,
  type ReleaseNotesLink,
  type RuntimeUpdateBusyAction
} from '@/features/system-status';
import { useAppMeta } from '@/shared/hooks/use-app-meta';
import type { ReactNode } from 'react';
import { RuntimeStatusEntry } from '@/app/components/layout/runtime-status-entry';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import { hostCapabilityManager } from '@/shared/lib/host-capabilities';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';
import { ExternalLink } from 'lucide-react';

type BrandHeaderProps = {
  className?: string;
  density?: 'sidebar' | 'chrome';
  suffix?: ReactNode;
};

export function BrandHeader({ className, density = 'sidebar', suffix }: BrandHeaderProps) {
  const { data } = useAppMeta();
  const { supported, busyAction, snapshot } = useRuntimeUpdateStore();
  const productName = data?.name ?? 'NextClaw';
  const productVersion = data?.productVersion?.trim();
  const versionLabel = productVersion ? `v${productVersion}` : null;
  const releaseNotesLink = useCurrentVersionReleaseNotesLink(productVersion);
  const resolvedSuffix = suffix ?? <RuntimeStatusEntry />;
  const shouldReserveMacWindowControls = typeof window !== 'undefined' && window.nextclawDesktop?.platform === 'darwin';
  const isChromeDensity = density === 'chrome';

  return (
    <div className={cn(className ?? 'flex min-w-0 items-center gap-2', shouldReserveMacWindowControls && 'pl-[58px]')}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center overflow-hidden',
        isChromeDensity ? 'h-6 w-6 rounded-md' : 'h-6 w-6 rounded-md',
        )}
      >
        <img src="/logo.svg" alt={productName} className="h-full w-full object-contain" />
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-baseline gap-1.5">
          <span
            className={cn(
              'shrink-0 font-semibold text-gray-800',
              isChromeDensity ? 'text-[15px]' : 'text-[14px]',
            )}
          >
            {productName}
          </span>
          {versionLabel ? <BrandVersionLabel versionLabel={versionLabel} density={density} releaseNotesLink={releaseNotesLink} /> : null}
        </div>
        <RuntimeUpdateInlineStatus supported={supported} busyAction={busyAction} snapshot={snapshot} />
        {resolvedSuffix ? <span className="inline-flex items-center shrink-0">{resolvedSuffix}</span> : null}
      </div>
    </div>
  );
}

function BrandVersionLabel({
  versionLabel,
  density,
  releaseNotesLink,
}: {
  versionLabel: string;
  density: BrandHeaderProps['density'];
  releaseNotesLink: ReleaseNotesLink | null;
}) {
  const isChromeDensity = density === 'chrome';
  const triggerClassName = cn(
    'block min-w-0 flex-1 truncate font-medium text-gray-500 outline-none',
    isChromeDensity ? 'text-[12px]' : 'text-[12px]',
    releaseNotesLink && 'cursor-pointer rounded-sm transition-colors hover:text-gray-700 hover:underline focus-visible:ring-2 focus-visible:ring-gray-300'
  );
  const tooltip = releaseNotesLink
    ? [
        t('desktopUpdatesVersionTooltipCurrent').replace('{version}', versionLabel),
        t('desktopUpdatesVersionTooltipReleaseNotes').replace('{version}', releaseNotesLink.versionLabel)
      ].join('\n')
    : versionLabel;
  const trigger = releaseNotesLink ? (
    <button
      type="button"
      aria-label={t('desktopUpdatesVersionReleaseNotesLabel').replace('{currentVersion}', versionLabel).replace('{releaseVersion}', releaseNotesLink.versionLabel)}
      className={cn(triggerClassName, 'border-0 bg-transparent p-0 text-left')}
      onClick={() => void hostCapabilityManager.openExternalUrl(releaseNotesLink.url)}
    >
      {versionLabel}
    </button>
  ) : (
    <span tabIndex={0} aria-label={versionLabel} className={triggerClassName}>
      {versionLabel}
    </span>
  );

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-72 whitespace-pre-line text-xs leading-relaxed">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function RuntimeUpdateInlineStatus({
  supported,
  busyAction,
  snapshot,
}: {
  supported: boolean;
  busyAction: RuntimeUpdateBusyAction;
  snapshot: UpdateSnapshot | null;
}) {
  if (!supported || !snapshot) {
    return null;
  }
  const releaseNotesLink = resolveUpdateReleaseNotesLink(snapshot);
  if (snapshot.status === 'downloading') {
    return (
      <RuntimeUpdateInlineGroup>
        <RuntimeUpdateInlineBadge snapshot={snapshot} />
        {releaseNotesLink ? <RuntimeUpdateReleaseNotesButton link={releaseNotesLink} tone="amber" /> : null}
      </RuntimeUpdateInlineGroup>
    );
  }
  if (snapshot.status === 'blocked' || snapshot.status === 'failed') {
    return <RuntimeUpdateInlineBadge snapshot={snapshot} />;
  }
  if (snapshot.status === 'downloaded') {
    return (
      <RuntimeUpdateInlineGroup>
        <button
          type="button"
          className="inline-flex h-5 shrink-0 items-center rounded-full bg-emerald-50 px-2 text-[11px] font-semibold leading-none text-emerald-700 ring-1 ring-emerald-100 transition-colors hover:bg-emerald-100 disabled:opacity-70"
          disabled={busyAction === 'applying'}
          onClick={() => void runtimeUpdateManager.applyDownloadedUpdate()}
        >
          {busyAction === 'applying' ? t('desktopUpdatesInlineApplying') : t('desktopUpdatesInlineReady')}
        </button>
        {releaseNotesLink ? <RuntimeUpdateReleaseNotesButton link={releaseNotesLink} tone="emerald" /> : null}
      </RuntimeUpdateInlineGroup>
    );
  }
  if (snapshot.status === 'update-available') {
    return (
      <RuntimeUpdateInlineGroup>
        <button
          type="button"
          className="inline-flex h-5 shrink-0 items-center rounded-full bg-amber-50 px-2 text-[11px] font-semibold leading-none text-amber-700 ring-1 ring-amber-100 transition-colors hover:bg-amber-100 disabled:opacity-70"
          disabled={busyAction === 'downloading'}
          onClick={() => void runtimeUpdateManager.downloadUpdate()}
        >
          {busyAction === 'downloading' ? t('desktopUpdatesInlineDownloading') : t('desktopUpdatesInlineDownload')}
        </button>
        {releaseNotesLink ? <RuntimeUpdateReleaseNotesButton link={releaseNotesLink} tone="amber" /> : null}
      </RuntimeUpdateInlineGroup>
    );
  }
  return null;
}

function RuntimeUpdateInlineGroup({ children }: { children: ReactNode }) {
  return <span className="inline-flex shrink-0 items-center gap-1">{children}</span>;
}

function RuntimeUpdateReleaseNotesButton({
  link,
  tone,
}: {
  link: ReleaseNotesLink;
  tone: 'amber' | 'emerald';
}) {
  const label = t('desktopUpdatesUpdateReleaseNotesLabel').replace('{version}', link.versionLabel);
  const className = cn(
    'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2',
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100 hover:bg-emerald-100 focus-visible:ring-emerald-300'
      : 'bg-amber-50 text-amber-700 ring-amber-100 hover:bg-amber-100 focus-visible:ring-amber-300'
  );
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={className}
            onClick={() => void hostCapabilityManager.openExternalUrl(link.url)}
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="img"
            aria-label={title}
            tabIndex={0}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[13px] font-bold leading-none text-amber-700 ring-1 ring-amber-100 outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            !
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-80 whitespace-pre-line break-words text-xs leading-relaxed">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function resolveInlineDownloadLabel(snapshot: UpdateSnapshot): string {
  const percent = snapshot.progress?.percent;
  return percent === null || percent === undefined
    ? t('desktopUpdatesInlineDownloading')
    : t('desktopUpdatesInlineDownloadingPercent').replace('{percent}', String(percent));
}
