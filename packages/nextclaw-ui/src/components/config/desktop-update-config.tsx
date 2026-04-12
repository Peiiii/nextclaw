import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PageHeader, PageLayout } from '@/components/layout/page-layout';
import { desktopUpdateManager } from '@/desktop/managers/desktop-update.manager';
import { useDesktopUpdateStore } from '@/desktop/stores/desktop-update.store';
import { formatDateTime, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Download, ExternalLink, RefreshCw, RotateCw } from 'lucide-react';

function formatVersion(value: string | null): string {
  return value?.trim() || '-';
}

function formatLastCheckedAt(value: string | null): string {
  return value ? formatDateTime(value) : '-';
}

function getStatusLabel(status: string): string {
  if (status === 'checking') {
    return t('desktopUpdatesStatusChecking');
  }
  if (status === 'update-available') {
    return t('desktopUpdatesStatusAvailable');
  }
  if (status === 'downloading') {
    return t('desktopUpdatesStatusDownloading');
  }
  if (status === 'downloaded') {
    return t('desktopUpdatesStatusDownloaded');
  }
  if (status === 'up-to-date') {
    return t('desktopUpdatesStatusUpToDate');
  }
  if (status === 'failed') {
    return t('desktopUpdatesStatusFailed');
  }
  return t('desktopUpdatesStatusIdle');
}

function getStatusTone(status: string): string {
  if (status === 'downloaded') {
    return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  }
  if (status === 'update-available' || status === 'downloading' || status === 'checking') {
    return 'bg-amber-50 text-amber-700 ring-amber-100';
  }
  if (status === 'failed') {
    return 'bg-red-50 text-red-700 ring-red-100';
  }
  return 'bg-gray-100 text-gray-700 ring-gray-200';
}

export function DesktopUpdateConfig() {
  const { supported, initialized, busyAction, snapshot } = useDesktopUpdateStore();

  useEffect(() => {
    void desktopUpdateManager.start();
    return () => {
      desktopUpdateManager.stop();
    };
  }, []);

  if (!initialized) {
    return <div className="p-8 text-gray-400">{t('loading')}</div>;
  }

  if (!supported || !snapshot) {
    return (
      <PageLayout className="space-y-6">
        <PageHeader
          title={t('desktopUpdatesPageTitle')}
          description={t('desktopUpdatesPageDescription')}
        />
        <Card>
          <CardHeader>
            <CardTitle>{t('desktopUpdatesDesktopOnlyTitle')}</CardTitle>
            <CardDescription>{t('desktopUpdatesDesktopOnlyDescription')}</CardDescription>
          </CardHeader>
        </Card>
      </PageLayout>
    );
  }

  const isChecking = busyAction === 'checking';
  const isDownloading = busyAction === 'downloading';
  const isApplying = busyAction === 'applying';
  const isSavingPreferences = busyAction === 'saving-preferences';
  const canDownload = snapshot.status === 'update-available' && !isDownloading && !isApplying;
  const canApply = snapshot.status === 'downloaded' && !isApplying;

  return (
    <PageLayout className="space-y-6">
      <PageHeader
        title={t('desktopUpdatesPageTitle')}
        description={t('desktopUpdatesPageDescription')}
        actions={(
          <Button
            variant="outline"
            onClick={() => void desktopUpdateManager.checkForUpdates()}
            disabled={isChecking || isDownloading || isApplying}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isChecking && 'animate-spin')} />
            {t('desktopUpdatesCheckNow')}
          </Button>
        )}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('desktopUpdatesOverviewTitle')}</CardTitle>
          <CardDescription>{t('desktopUpdatesOverviewDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">{t('desktopUpdatesStatusLabel')}</span>
            <span className={cn('inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1', getStatusTone(snapshot.status))}>
              {getStatusLabel(snapshot.status)}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500">{t('desktopUpdatesLauncherVersion')}</p>
              <p className="mt-2 text-base font-semibold text-gray-900">{formatVersion(snapshot.launcherVersion)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500">{t('desktopUpdatesCurrentBundleVersion')}</p>
              <p className="mt-2 text-base font-semibold text-gray-900">{formatVersion(snapshot.currentVersion)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500">{t('desktopUpdatesAvailableVersion')}</p>
              <p className="mt-2 text-base font-semibold text-gray-900">{formatVersion(snapshot.availableVersion)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500">{t('desktopUpdatesLastCheckedAt')}</p>
              <p className="mt-2 text-base font-semibold text-gray-900">{formatLastCheckedAt(snapshot.lastCheckedAt)}</p>
            </div>
          </div>

          {snapshot.downloadedVersion ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <p className="text-sm font-semibold text-emerald-800">{t('desktopUpdatesDownloadedBannerTitle')}</p>
              <p className="mt-1 text-sm text-emerald-700">
                {t('desktopUpdatesDownloadedBannerDescription').replace('{version}', snapshot.downloadedVersion)}
              </p>
            </div>
          ) : null}

          {snapshot.errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50/70 p-4 text-sm text-red-700">
              {snapshot.errorMessage}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('desktopUpdatesPreferencesTitle')}</CardTitle>
          <CardDescription>{t('desktopUpdatesPreferencesDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4">
            <div className="space-y-1">
              <Label>{t('desktopUpdatesAutomaticChecks')}</Label>
              <p className="text-sm text-gray-500">{t('desktopUpdatesAutomaticChecksHelp')}</p>
            </div>
            <Switch
              checked={snapshot.preferences.automaticChecks}
              disabled={isSavingPreferences}
              onCheckedChange={(checked) => void desktopUpdateManager.updatePreferences({ automaticChecks: checked })}
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4">
            <div className="space-y-1">
              <Label>{t('desktopUpdatesAutoDownload')}</Label>
              <p className="text-sm text-gray-500">{t('desktopUpdatesAutoDownloadHelp')}</p>
            </div>
            <Switch
              checked={snapshot.preferences.autoDownload}
              disabled={isSavingPreferences}
              onCheckedChange={(checked) => void desktopUpdateManager.updatePreferences({ autoDownload: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('desktopUpdatesActionsTitle')}</CardTitle>
          <CardDescription>{t('desktopUpdatesActionsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => void desktopUpdateManager.checkForUpdates()}
            disabled={isChecking || isDownloading || isApplying}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', isChecking && 'animate-spin')} />
            {t('desktopUpdatesCheckNow')}
          </Button>

          <Button onClick={() => void desktopUpdateManager.downloadUpdate()} disabled={!canDownload}>
            <Download className={cn('mr-2 h-4 w-4', isDownloading && 'animate-bounce')} />
            {t('desktopUpdatesDownloadNow')}
          </Button>

          <Button variant="secondary" onClick={() => void desktopUpdateManager.applyDownloadedUpdate()} disabled={!canApply}>
            <RotateCw className={cn('mr-2 h-4 w-4', isApplying && 'animate-spin')} />
            {t('desktopUpdatesApplyNow')}
          </Button>

          {snapshot.releaseNotesUrl ? (
            <Button variant="ghost" onClick={() => window.open(snapshot.releaseNotesUrl ?? '', '_blank', 'noopener,noreferrer')}>
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('desktopUpdatesReleaseNotes')}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
