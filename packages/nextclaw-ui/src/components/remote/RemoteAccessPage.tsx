import type { RemoteAccessView } from '@/api/remote.types';
import { PageHeader, PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusDot } from '@/components/ui/status-dot';
import { useRemoteStatus } from '@/hooks/useRemoteAccess';
import { formatDateTime, t } from '@/lib/i18n';
import { useAppPresenter } from '@/presenter/app-presenter-context';
import { useRemoteAccessStore } from '@/remote/stores/remote-access.store';
import { Laptop, RefreshCcw, ShieldCheck, SquareArrowOutUpRight, Wifi, Wrench } from 'lucide-react';
import { useEffect, useMemo } from 'react';

type RemoteHeroView = {
  badgeStatus: 'active' | 'inactive' | 'ready' | 'setup' | 'warning';
  badgeLabel: string;
  title: string;
  description: string;
};

function KeyValueRow(props: { label: string; value?: string | number | null; muted?: boolean }) {
  const value = props.value === undefined || props.value === null || props.value === '' ? '-' : String(props.value);
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-gray-500">{props.label}</span>
      <span className={props.muted ? 'text-right text-gray-500' : 'text-right text-gray-900'}>{value}</span>
    </div>
  );
}

function buildHeroView(status: RemoteAccessView | undefined): RemoteHeroView {
  if (!status?.account.loggedIn) {
    return {
      badgeStatus: 'setup',
      badgeLabel: t('statusSetup'),
      title: t('remoteStatusNeedsSignIn'),
      description: t('remoteStatusNeedsSignInDescription')
    };
  }

  if (!status.settings.enabled) {
    return {
      badgeStatus: 'inactive',
      badgeLabel: t('statusInactive'),
      title: t('remoteStatusNeedsEnable'),
      description: t('remoteStatusNeedsEnableDescription')
    };
  }

  if (!status.service.running) {
    return {
      badgeStatus: 'warning',
      badgeLabel: t('remoteServiceStopped'),
      title: t('remoteStatusNeedsServiceTitle'),
      description: t('remoteStatusNeedsServiceDescription')
    };
  }

  if (status.runtime?.state === 'connected') {
    return {
      badgeStatus: 'ready',
      badgeLabel: t('statusReady'),
      title: t('remoteStatusReadyTitle'),
      description: t('remoteStatusReadyDescription')
    };
  }

  if (status.runtime?.state === 'connecting') {
    return {
      badgeStatus: 'active',
      badgeLabel: t('connecting'),
      title: t('remoteStatusConnectingTitle'),
      description: t('remoteStatusConnectingDescription')
    };
  }

  return {
    badgeStatus: 'warning',
    badgeLabel: t('remoteStateDisconnected'),
    title: t('remoteStatusIssueTitle'),
    description: t('remoteStatusIssueDescription')
  };
}

export function RemoteAccessPage() {
  const presenter = useAppPresenter();
  const remoteStatus = useRemoteStatus();
  const status = remoteStatus.data;
  const enabled = useRemoteAccessStore((state) => state.enabled);
  const deviceName = useRemoteAccessStore((state) => state.deviceName);
  const platformApiBase = useRemoteAccessStore((state) => state.platformApiBase);
  const advancedOpen = useRemoteAccessStore((state) => state.advancedOpen);
  const actionLabel = useRemoteAccessStore((state) => state.actionLabel);
  const doctor = useRemoteAccessStore((state) => state.doctor);
  const heroView = useMemo(() => buildHeroView(status), [status]);
  const dirty = Boolean(
    status &&
      (enabled !== status.settings.enabled ||
        deviceName !== status.settings.deviceName ||
        platformApiBase !== status.settings.platformApiBase)
  );
  const busy = Boolean(actionLabel);

  useEffect(() => {
    presenter.remoteAccessManager.syncStatus(status);
  }, [presenter, status]);

  if (remoteStatus.isLoading && !status) {
    return <div className="p-8 text-gray-400">{t('remoteLoading')}</div>;
  }

  return (
    <PageLayout className="space-y-6">
      <PageHeader title={t('remotePageTitle')} description={t('remotePageDescription')} />

      <Card className="overflow-hidden border-none bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-xl">
        <CardContent className="grid gap-6 px-6 py-6 md:grid-cols-[1.25fr_0.75fr] md:px-8">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusDot status={heroView.badgeStatus} label={heroView.badgeLabel} />
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-slate-200">
                NextClaw Web
              </span>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">{heroView.title}</h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">{heroView.description}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {!status?.account.loggedIn ? (
                <Button size="lg" onClick={() => void presenter.remoteAccessManager.enableRemoteAccess(status)} disabled={busy}>
                  {actionLabel || t('remoteSignInAndEnable')}
                </Button>
              ) : !status.settings.enabled ? (
                <Button size="lg" onClick={() => void presenter.remoteAccessManager.enableRemoteAccess(status)} disabled={busy}>
                  {actionLabel || t('remoteEnableNow')}
                </Button>
              ) : status.runtime?.state === 'connected' ? (
                <Button size="lg" onClick={() => void presenter.accountManager.openNextClawWeb()} disabled={busy}>
                  <SquareArrowOutUpRight className="mr-2 h-4 w-4" />
                  {t('remoteOpenWeb')}
                </Button>
              ) : (
                <Button size="lg" onClick={() => void presenter.remoteAccessManager.repairRemoteAccess(status)} disabled={busy}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  {actionLabel || t('remoteReconnectNow')}
                </Button>
              )}
              {status?.settings.enabled ? (
                <Button variant="outline" size="lg" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => void presenter.remoteAccessManager.disableRemoteAccess(status)} disabled={busy}>
                  {t('remoteDisable')}
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-slate-400">{t('remoteOpenWebHint')}</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Laptop className="h-4 w-4 text-primary-foreground" />
              {t('remoteDeviceSummaryTitle')}
            </div>
            <p className="mt-2 text-sm text-slate-300">{t('remoteDeviceSummaryDescription')}</p>
            <div className="mt-4 space-y-2">
              <KeyValueRow label={t('remoteDeviceName')} value={status?.runtime?.deviceName ?? status?.settings.deviceName} />
              <KeyValueRow label={t('remoteSignedInAccount')} value={status?.account.email} />
              <KeyValueRow label={t('remoteConnectionStatus')} value={heroView.badgeLabel} />
              <KeyValueRow label={t('remoteLastConnectedAt')} value={status?.runtime?.lastConnectedAt ? formatDateTime(status.runtime.lastConnectedAt) : '-'} muted />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-primary" />
              {t('remoteOverviewTitle')}
            </CardTitle>
            <CardDescription>{t('remoteOverviewDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusDot status={status?.account.loggedIn ? 'ready' : 'inactive'} label={status?.account.loggedIn ? t('remoteAccountConnected') : t('remoteAccountNotConnected')} />
              <StatusDot status={status?.service.running ? 'active' : 'inactive'} label={status?.service.running ? t('remoteServiceRunning') : t('remoteServiceStopped')} />
              <StatusDot status={heroView.badgeStatus} label={heroView.badgeLabel} />
            </div>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <KeyValueRow label={t('remoteLocalOrigin')} value={status?.localOrigin} />
              <KeyValueRow label={t('remotePublicPlatform')} value={status?.platformBase ?? status?.account.platformBase} />
              <KeyValueRow label={t('remoteDeviceId')} value={status?.runtime?.deviceId} muted />
              <KeyValueRow label={t('remoteLastError')} value={status?.runtime?.lastError} muted />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Laptop className="h-4 w-4 text-primary" />
              {t('remoteDeviceTitle')}
            </CardTitle>
            <CardDescription>{t('remoteOpenWebHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t('remoteEnabled')}</p>
                  <p className="mt-1 text-xs text-gray-500">{t('remoteEnabledHelp')}</p>
                </div>
                <button
                  type="button"
                  aria-label={t('remoteEnabled')}
                  onClick={() => presenter.remoteAccessManager.setEnabled(!enabled)}
                  disabled={busy}
                  className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remote-device-name">{t('remoteDeviceName')}</Label>
              <Input
                id="remote-device-name"
                value={deviceName}
                onChange={(event) => presenter.remoteAccessManager.setDeviceName(event.target.value)}
                placeholder={t('remoteDeviceNamePlaceholder')}
              />
            </div>

            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {status?.account.loggedIn
                ? t('remoteStatusNeedsEnableDescription')
                : t('remoteStatusNeedsSignInDescription')}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            {t('remoteAdvancedTitle')}
          </CardTitle>
          <CardDescription>{t('remoteAdvancedDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={() => presenter.remoteAccessManager.setAdvancedOpen(!advancedOpen)}>
            {advancedOpen ? t('remoteAdvancedToggleClose') : t('remoteAdvancedToggleOpen')}
          </Button>

          {advancedOpen ? (
            <div className="space-y-6 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="remote-platform-api-base">{t('remotePlatformApiBase')}</Label>
                <Input
                  id="remote-platform-api-base"
                  value={platformApiBase}
                  onChange={(event) => presenter.remoteAccessManager.setPlatformApiBase(event.target.value)}
                  placeholder="https://ai-gateway-api.nextclaw.io/v1"
                />
                <p className="text-xs text-gray-500">{t('remotePlatformApiBaseHelp')}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void presenter.remoteAccessManager.saveAdvancedSettings(status)} disabled={!dirty || busy}>
                  {actionLabel || t('remoteSaveSettings')}
                </Button>
                <Button variant="outline" onClick={() => void presenter.remoteAccessManager.startService()} disabled={busy}>
                  {t('remoteStartService')}
                </Button>
                <Button variant="outline" onClick={() => void presenter.remoteAccessManager.restartService()} disabled={busy}>
                  {t('remoteRestartService')}
                </Button>
                <Button variant="outline" onClick={() => void presenter.remoteAccessManager.stopService()} disabled={busy}>
                  {t('remoteStopService')}
                </Button>
                <Button variant="outline" onClick={() => void presenter.remoteAccessManager.runDoctor()} disabled={busy}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {t('remoteRunDoctor')}
                </Button>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <KeyValueRow label={t('remoteServicePid')} value={status?.service.pid} />
                  <KeyValueRow label={t('remoteServiceUiUrl')} value={status?.service.uiUrl} />
                  <KeyValueRow label={t('remoteServiceCurrentProcess')} value={status?.service.currentProcess ? t('yes') : t('no')} />
                  <KeyValueRow label={t('remoteConnectionStatus')} value={status?.runtime?.state} muted />
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <KeyValueRow label={t('remoteDeviceId')} value={status?.runtime?.deviceId} />
                  <KeyValueRow label={t('remoteRuntimeUpdatedAt')} value={status?.runtime?.updatedAt ? formatDateTime(status.runtime.updatedAt) : '-'} muted />
                  <KeyValueRow label={t('remoteLastConnectedAt')} value={status?.runtime?.lastConnectedAt ? formatDateTime(status.runtime.lastConnectedAt) : '-'} muted />
                  <KeyValueRow label={t('remoteLastError')} value={status?.runtime?.lastError} muted />
                </div>
              </div>

              {doctor ? (
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <KeyValueRow label={t('remoteDoctorGeneratedAt')} value={formatDateTime(doctor.generatedAt)} muted />
                  <div className="mt-3 space-y-2">
                    {doctor.checks.map((check) => (
                      <div key={check.name} className="rounded-xl border border-gray-100 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-gray-900">{check.name}</span>
                          <StatusDot status={check.ok ? 'ready' : 'warning'} label={check.ok ? t('remoteCheckPassed') : t('remoteCheckFailed')} />
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{check.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t('remoteDoctorEmpty')}</p>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
