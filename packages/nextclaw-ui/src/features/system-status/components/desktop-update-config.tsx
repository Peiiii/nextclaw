import type { UpdateSnapshot } from '@nextclaw/shared';
import { useQuery } from '@tanstack/react-query';
import { runtimeUpdateManager, useRuntimeUpdateStore } from '@/features/system-status';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { PageHeader, PageLayout } from '@/app/components/layout/page-layout';
import { formatDateTime, getLanguage, t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/utils';
import { hostCapabilityManager } from '@/shared/lib/host-capabilities';
import {
  fetchReleaseNotesData,
  readReleaseNotesText,
  resolveReleaseNotesDataUrl,
  type ReleaseNotesLocale,
  type ReleaseNotesSection
} from '@/features/system-status/utils/update-release-notes.utils';
import { Download, ExternalLink, RefreshCw, RotateCw } from 'lucide-react';

const STATUS_LABEL_KEYS: Record<string, string> = {
  checking: 'desktopUpdatesStatusChecking',
  'update-available': 'desktopUpdatesStatusAvailable',
  downloading: 'desktopUpdatesStatusDownloading',
  downloaded: 'desktopUpdatesStatusDownloaded',
  'up-to-date': 'desktopUpdatesStatusUpToDate',
  blocked: 'desktopUpdatesStatusBlocked',
  failed: 'desktopUpdatesStatusFailed',
};

const RELEASE_NOTES_KIND_LABEL_KEYS: Record<string, string> = {
  feature: 'desktopUpdatesReleaseNotesFeature',
  enhancement: 'desktopUpdatesReleaseNotesEnhancement',
  fix: 'desktopUpdatesReleaseNotesFix',
  compatibility: 'desktopUpdatesReleaseNotesCompatibility'
};

function StatusBadge({ status }: { status: string }) {
  return <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1', getStatusTone(status))}>{getStatusLabel(status)}</span>;
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4"><p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500">{label}</p><p className="mt-2 text-base font-semibold text-gray-900">{value}</p></div>;
}

function DownloadProgress({ snapshot }: { snapshot: UpdateSnapshot }) {
  if (snapshot.status !== 'downloading') {
    return null;
  }
  const percent = snapshot.progress?.percent;
  const progressLabel = percent === null || percent === undefined
    ? t('desktopUpdatesDownloadProgressUnknown')
    : t('desktopUpdatesDownloadProgressPercent').replace('{percent}', String(percent));
  const byteLabel = formatDownloadBytes(snapshot.progress?.downloadedBytes ?? 0, snapshot.progress?.totalBytes ?? null);
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-amber-800">{progressLabel}</p>
        <p className="text-xs font-medium text-amber-700">{byteLabel}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-100">
        <div className="h-full rounded-full bg-amber-500 transition-[width]" style={{ width: `${percent ?? 0}%` }} />
      </div>
    </div>
  );
}

function PreferenceToggle({
  label,
  help,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4">
      <div className="space-y-1">
        <Label>{label}</Label>
        <p className="text-sm text-gray-500">{help}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function formatVersion(value: string | null): string {
  return value?.trim() || '-';
}
function formatLastCheckedAt(value: string | null): string {
  return value ? formatDateTime(value) : '-';
}
function formatDownloadBytes(downloadedBytes: number, totalBytes: number | null): string {
  const downloaded = formatBytes(downloadedBytes);
  return totalBytes && totalBytes > 0 ? `${downloaded} / ${formatBytes(totalBytes)}` : downloaded;
}
function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let cursor = value;
  let unitIndex = 0;
  while (cursor >= 1024 && unitIndex < units.length - 1) {
    cursor /= 1024;
    unitIndex += 1;
  }
  return `${cursor >= 10 || unitIndex === 0 ? cursor.toFixed(0) : cursor.toFixed(1)} ${units[unitIndex]}`;
}
function getChannelLabel(channel: UpdateSnapshot['channel']): string {
  return channel === 'beta' ? t('desktopUpdatesChannelBeta') : t('desktopUpdatesChannelStable');
}
function getStatusLabel(status: string): string {
  return t(STATUS_LABEL_KEYS[status] ?? 'desktopUpdatesStatusIdle');
}
function getStatusTone(status: string): string {
  if (status === 'downloaded') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  }
  if (status === 'update-available' || status === 'downloading' || status === 'checking') {
    return 'bg-amber-50 text-amber-700 ring-amber-100';
  }
  if (status === 'failed' || status === 'blocked') {
    return 'bg-red-50 text-red-700 ring-red-100';
  }
  return 'bg-gray-100 text-gray-700 ring-gray-200';
}

function getReleaseNotesLocale(): ReleaseNotesLocale {
  return getLanguage() === 'zh' ? 'zh-CN' : 'en-US';
}

function getReleaseNotesSectionTitle(section: ReleaseNotesSection, locale: ReleaseNotesLocale): string {
  const title = readReleaseNotesText(section.title, locale);
  return title ?? t(RELEASE_NOTES_KIND_LABEL_KEYS[section.kind] ?? 'desktopUpdatesReleaseNotesEnhancement');
}

function ReleaseNotesPreview({ snapshot }: { snapshot: UpdateSnapshot }) {
  const dataUrl = resolveReleaseNotesDataUrl(snapshot);
  const locale = getReleaseNotesLocale();
  const releaseNotesQuery = useQuery({
    queryKey: ['runtime-release-notes', dataUrl],
    queryFn: async () => await fetchReleaseNotesData(dataUrl ?? ''),
    enabled: Boolean(dataUrl),
    retry: false,
    staleTime: 5 * 60 * 1000
  });
  const payload = releaseNotesQuery.data;
  const title = readReleaseNotesText(payload?.title, locale) ?? t('desktopUpdatesReleaseNotesPreviewTitle');
  const summary = readReleaseNotesText(payload?.summary, locale) ?? t('desktopUpdatesReleaseNotesPreviewDescription');

  if (!snapshot.releaseNotesUrl) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{summary}</CardDescription>
          </div>
          <Button variant="ghost" onClick={() => void hostCapabilityManager.openExternalUrl(snapshot.releaseNotesUrl ?? '')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {t('desktopUpdatesReleaseNotes')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {releaseNotesQuery.isLoading ? (
          <p className="text-sm text-gray-500">{t('desktopUpdatesReleaseNotesPreviewLoading')}</p>
        ) : null}
        {!dataUrl || releaseNotesQuery.isError ? (
          <p className="text-sm text-gray-500">{t('desktopUpdatesReleaseNotesPreviewUnavailable')}</p>
        ) : null}
        {payload ? (
          <div className="grid gap-4 md:grid-cols-2">
            {payload.sections.map((section) => (
              <div key={section.kind} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <p className="text-sm font-semibold text-gray-900">{getReleaseNotesSectionTitle(section, locale)}</p>
                <ul className="mt-3 space-y-3">
                  {section.items.map((item, index) => {
                    const itemTitle = readReleaseNotesText(item.title, locale);
                    const itemBody = readReleaseNotesText(item.body, locale);
                    return (
                      <li key={`${itemTitle ?? section.kind}-${index}`} className="space-y-1">
                        {itemTitle ? <p className="text-sm font-medium text-gray-800">{itemTitle}</p> : null}
                        {itemBody ? <p className="text-sm leading-5 text-gray-600">{itemBody}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function RuntimeUpdateUnavailableState() {
  return (
    <PageLayout className="space-y-6">
      <PageHeader title={t('runtimeUpdatesPageTitle')} description={t('runtimeUpdatesPageDescription')} />
      <Card>
        <CardHeader>
          <CardTitle>{t('runtimeUpdatesUnavailableTitle')}</CardTitle>
          <CardDescription>{t('runtimeUpdatesUnavailableDescription')}</CardDescription>
        </CardHeader>
        <CardContent><p className="text-sm text-gray-500">{t('runtimeUpdatesUnavailableHint')}</p></CardContent>
      </Card>
    </PageLayout>
  );
}

export function DesktopUpdateConfig() {
  const { supported, initialized, busyAction, snapshot } = useRuntimeUpdateStore();
  if (!initialized) {
    return <div className="p-8 text-gray-400">{t('loading')}</div>;
  }
  if (!supported || !snapshot) {
    return <RuntimeUpdateUnavailableState />;
  }
  const isChecking = busyAction === 'checking';
  const isDownloading = busyAction === 'downloading';
  const isApplying = busyAction === 'applying';
  const isSavingPreferences = busyAction === 'saving-preferences';
  const isSwitchingChannel = busyAction === 'switching-channel';
  const canDownload = snapshot.status === 'update-available' && !isDownloading && !isApplying;
  const canApply = snapshot.status === 'downloaded' && !isApplying;
  const overviewStats = [
    [t('runtimeUpdatesHostVersion'), formatVersion(snapshot.hostVersion)],
    [t('desktopUpdatesCurrentBundleVersion'), formatVersion(snapshot.currentVersion)],
    [t('desktopUpdatesAvailableVersion'), formatVersion(snapshot.availableVersion)],
    [t('desktopUpdatesLastCheckedAt'), formatLastCheckedAt(snapshot.lastCheckedAt)],
    [t('desktopUpdatesCurrentChannel'), getChannelLabel(snapshot.channel)],
  ] as const;
  return (
    <PageLayout className="space-y-6">
      <PageHeader
        title={t('runtimeUpdatesPageTitle')}
        description={t('runtimeUpdatesPageDescription')}
        actions={<Button variant="outline" onClick={() => void runtimeUpdateManager.checkForUpdates()} disabled={isChecking || isDownloading || isApplying}><RefreshCw className={cn('mr-2 h-4 w-4', isChecking && 'animate-spin')} />{t('desktopUpdatesCheckNow')}</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('desktopUpdatesOverviewTitle')}</CardTitle>
          <CardDescription>{t('desktopUpdatesOverviewDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-medium text-gray-700">{t('desktopUpdatesStatusLabel')}</span><StatusBadge status={snapshot.status} /></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{overviewStats.map(([label, value]) => <OverviewStat key={label} label={label} value={value} />)}</div>
          {snapshot.channel === 'beta' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="text-sm font-semibold text-amber-800">{t('desktopUpdatesBetaBadgeTitle')}</p>
              <p className="mt-1 text-sm text-amber-700">{t('desktopUpdatesBetaBadgeDescription')}</p>
            </div>
          ) : null}
          {snapshot.downloadedVersion ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-sm font-semibold text-emerald-800">{t('desktopUpdatesDownloadedBannerTitle')}</p>
              <p className="mt-1 text-sm text-emerald-700">{t('runtimeUpdatesDownloadedBannerDescription').replace('{version}', snapshot.downloadedVersion)}</p>
            </div>
          ) : null}
          <DownloadProgress snapshot={snapshot} />
          {snapshot.status === 'blocked' ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
              <p className="text-sm font-semibold text-red-800">{t('desktopUpdatesBlockedTitle')}</p>
              <p className="mt-1 text-sm text-red-700">{snapshot.errorMessage ?? t('desktopUpdatesBlockedDescription')}</p>
              {snapshot.recoveryCommand ? <code className="mt-3 block rounded-lg bg-white/70 px-3 py-2 text-xs text-red-800">{snapshot.recoveryCommand}</code> : null}
            </div>
          ) : null}
          {snapshot.errorMessage && snapshot.status !== 'blocked' ? <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-700">{snapshot.errorMessage}</div> : null}
        </CardContent>
      </Card>
      <ReleaseNotesPreview snapshot={snapshot} />
      <Card>
        <CardHeader>
          <CardTitle>{t('desktopUpdatesPreferencesTitle')}</CardTitle>
          <CardDescription>{t('desktopUpdatesPreferencesDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t('desktopUpdatesReleaseChannel')}</Label>
                <p className="text-sm text-gray-500">{t('desktopUpdatesReleaseChannelHelp')}</p>
              </div>
              <Select value={snapshot.channel} disabled={isSwitchingChannel || isChecking || isDownloading || isApplying} onValueChange={(value) => void runtimeUpdateManager.updateChannel(value as UpdateSnapshot['channel'])}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder={t('desktopUpdatesReleaseChannel')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stable">{t('desktopUpdatesChannelStable')}</SelectItem>
                  <SelectItem value="beta">{t('desktopUpdatesChannelBeta')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">{t('desktopUpdatesReleaseChannelDowngradeHint')}</p>
            </div>
          </div>
          <PreferenceToggle
            label={t('desktopUpdatesAutomaticChecks')}
            help={t('desktopUpdatesAutomaticChecksHelp')}
            checked={snapshot.preferences.automaticChecks}
            disabled={isSavingPreferences || isSwitchingChannel}
            onCheckedChange={(checked) => void runtimeUpdateManager.updatePreferences({ automaticChecks: checked })}
          />
          <PreferenceToggle
            label={t('desktopUpdatesAutoDownload')}
            help={t('desktopUpdatesAutoDownloadHelp')}
            checked={snapshot.preferences.autoDownload}
            disabled={isSavingPreferences || isSwitchingChannel}
            onCheckedChange={(checked) => void runtimeUpdateManager.updatePreferences({ autoDownload: checked })}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('desktopUpdatesActionsTitle')}</CardTitle>
          <CardDescription>{t('runtimeUpdatesActionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => void runtimeUpdateManager.checkForUpdates()} disabled={isChecking || isDownloading || isApplying}>
            <RefreshCw className={cn('mr-2 h-4 w-4', isChecking && 'animate-spin')} />
            {t('desktopUpdatesCheckNow')}
          </Button>
          <Button onClick={() => void runtimeUpdateManager.downloadUpdate()} disabled={!canDownload}>
            <Download className={cn('mr-2 h-4 w-4', isDownloading && 'animate-bounce')} />
            {t('desktopUpdatesDownloadNow')}
          </Button>
          <Button variant="secondary" onClick={() => void runtimeUpdateManager.applyDownloadedUpdate()} disabled={!canApply}>
            <RotateCw className={cn('mr-2 h-4 w-4', isApplying && 'animate-spin')} />
            {t('runtimeUpdatesApplyNow')}
          </Button>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
