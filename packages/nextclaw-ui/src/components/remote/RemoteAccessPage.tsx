import { useEffect, useMemo, useState } from 'react';
import type { RemoteRuntimeView, RemoteServiceView } from '@/api/types';
import {
  useRemoteDoctor,
  useRemoteLogin,
  useRemoteLogout,
  useRemoteServiceControl,
  useRemoteSettings,
  useRemoteStatus
} from '@/hooks/useRemoteAccess';
import { PageHeader, PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusDot } from '@/components/ui/status-dot';
import { Switch } from '@/components/ui/switch';
import { formatDateTime, t } from '@/lib/i18n';
import { Activity, KeyRound, Laptop, RefreshCcw, ServerCog, ShieldCheck, SquareTerminal } from 'lucide-react';

function getRuntimeStatus(runtime: RemoteRuntimeView | null): { status: 'active' | 'inactive' | 'ready' | 'setup' | 'warning'; label: string } {
  if (!runtime) {
    return { status: 'inactive', label: t('remoteRuntimeMissing') };
  }
  if (runtime.state === 'connected') {
    return { status: 'ready', label: t('remoteStateConnected') };
  }
  if (runtime.state === 'connecting') {
    return { status: 'warning', label: t('remoteStateConnecting') };
  }
  if (runtime.state === 'error') {
    return { status: 'warning', label: t('remoteStateError') };
  }
  if (runtime.state === 'disconnected') {
    return { status: 'warning', label: t('remoteStateDisconnected') };
  }
  return { status: 'inactive', label: t('remoteStateDisabled') };
}

function getServiceStatus(service: RemoteServiceView): { status: 'active' | 'inactive' | 'ready' | 'setup' | 'warning'; label: string } {
  if (!service.running) {
    return { status: 'inactive', label: t('remoteServiceStopped') };
  }
  return service.currentProcess
    ? { status: 'ready', label: t('remoteServiceManagedRunning') }
    : { status: 'active', label: t('remoteServiceRunning') };
}

function KeyValueRow(props: { label: string; value?: string | number | null; muted?: boolean }) {
  const value = props.value === undefined || props.value === null || props.value === '' ? '-' : String(props.value);
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-gray-500">{props.label}</span>
      <span className={props.muted ? 'text-right text-gray-500' : 'text-right text-gray-800'}>{value}</span>
    </div>
  );
}

export function RemoteAccessPage() {
  const remoteStatus = useRemoteStatus();
  const loginMutation = useRemoteLogin();
  const logoutMutation = useRemoteLogout();
  const settingsMutation = useRemoteSettings();
  const doctorMutation = useRemoteDoctor();
  const serviceMutation = useRemoteServiceControl();

  const status = remoteStatus.data;
  const runtimeStatus = useMemo(() => getRuntimeStatus(status?.runtime ?? null), [status?.runtime]);
  const serviceStatus = useMemo(() => getServiceStatus(status?.service ?? { running: false, currentProcess: false }), [status?.service]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginApiBase, setLoginApiBase] = useState('');
  const [register, setRegister] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [platformApiBase, setPlatformApiBase] = useState('');

  useEffect(() => {
    if (!status) {
      return;
    }
    setEnabled(status.settings.enabled);
    setDeviceName(status.settings.deviceName);
    setPlatformApiBase(status.settings.platformApiBase);
    if (!loginApiBase) {
      setLoginApiBase(status.account.apiBase ?? status.settings.platformApiBase ?? '');
    }
  }, [loginApiBase, status]);

  if (remoteStatus.isLoading && !status) {
    return <div className="p-8 text-gray-400">{t('remoteLoading')}</div>;
  }

  return (
    <PageLayout className="space-y-6">
      <PageHeader title={t('remotePageTitle')} description={t('remotePageDescription')} />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              {t('remoteOverviewTitle')}
            </CardTitle>
            <CardDescription>{t('remoteOverviewDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusDot status={status?.account.loggedIn ? 'ready' : 'inactive'} label={status?.account.loggedIn ? t('remoteAccountConnected') : t('remoteAccountNotConnected')} />
              <StatusDot status={serviceStatus.status} label={serviceStatus.label} />
              <StatusDot status={runtimeStatus.status} label={runtimeStatus.label} />
            </div>

            <div className="rounded-2xl border border-gray-200/70 bg-gray-50/70 px-4 py-3">
              <KeyValueRow label={t('remoteLocalOrigin')} value={status?.localOrigin} />
              <KeyValueRow label={t('remotePublicPlatform')} value={status?.platformBase ?? status?.account.platformBase} />
              <KeyValueRow label={t('remoteDeviceId')} value={status?.runtime?.deviceId} muted />
              <KeyValueRow label={t('remoteLastConnectedAt')} value={status?.runtime?.lastConnectedAt ? formatDateTime(status.runtime.lastConnectedAt) : '-'} muted />
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
            <CardDescription>{t('remoteDeviceDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-2xl border border-gray-200/70 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{t('remoteEnabled')}</p>
                  <p className="mt-1 text-xs text-gray-500">{t('remoteEnabledHelp')}</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remote-device-name">{t('remoteDeviceName')}</Label>
              <Input id="remote-device-name" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} placeholder={t('remoteDeviceNamePlaceholder')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remote-platform-api-base">{t('remotePlatformApiBase')}</Label>
              <Input
                id="remote-platform-api-base"
                value={platformApiBase}
                onChange={(event) => setPlatformApiBase(event.target.value)}
                placeholder="https://ai-gateway-api.nextclaw.io/v1"
              />
              <p className="text-xs text-gray-500">{t('remotePlatformApiBaseHelp')}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() =>
                  settingsMutation.mutate({
                    enabled,
                    deviceName,
                    platformApiBase
                  })
                }
                disabled={settingsMutation.isPending}
              >
                {settingsMutation.isPending ? t('saving') : t('remoteSaveSettings')}
              </Button>
              <Button
                variant="outline"
                onClick={() => serviceMutation.mutate('restart')}
                disabled={serviceMutation.isPending}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                {t('remoteRestartService')}
              </Button>
            </div>
            <p className="text-xs text-gray-500">{t('remoteSaveHint')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              {t('remoteAccountTitle')}
            </CardTitle>
            <CardDescription>{t('remoteAccountDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status?.account.loggedIn ? (
              <>
                <div className="rounded-2xl border border-gray-200/70 bg-gray-50/70 px-4 py-3">
                  <KeyValueRow label={t('remoteAccountEmail')} value={status.account.email} />
                  <KeyValueRow label={t('remoteAccountRole')} value={status.account.role} />
                  <KeyValueRow label={t('remoteApiBase')} value={status.account.apiBase} />
                </div>
                <Button variant="outline" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
                  {logoutMutation.isPending ? t('remoteLoggingOut') : t('remoteLogout')}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="remote-email">{t('remoteEmail')}</Label>
                  <Input id="remote-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remote-password">{t('remotePassword')}</Label>
                  <Input id="remote-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('remotePasswordPlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remote-login-api-base">{t('remoteApiBase')}</Label>
                  <Input
                    id="remote-login-api-base"
                    value={loginApiBase}
                    onChange={(event) => setLoginApiBase(event.target.value)}
                    placeholder="https://ai-gateway-api.nextclaw.io/v1"
                  />
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-gray-200/70 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{t('remoteRegisterIfNeeded')}</p>
                    <p className="mt-1 text-xs text-gray-500">{t('remoteRegisterIfNeededHelp')}</p>
                  </div>
                  <Switch checked={register} onCheckedChange={setRegister} />
                </div>
                <Button
                  onClick={() =>
                    loginMutation.mutate({
                      email,
                      password,
                      apiBase: loginApiBase,
                      register
                    })
                  }
                  disabled={loginMutation.isPending || !email.trim() || !password}
                >
                  {loginMutation.isPending ? t('remoteLoggingIn') : register ? t('remoteCreateAccount') : t('remoteLogin')}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ServerCog className="h-4 w-4 text-primary" />
              {t('remoteServiceTitle')}
            </CardTitle>
            <CardDescription>{t('remoteServiceDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-gray-200/70 bg-gray-50/70 px-4 py-3">
              <KeyValueRow label={t('remoteServicePid')} value={status?.service.pid} />
              <KeyValueRow label={t('remoteServiceUiUrl')} value={status?.service.uiUrl} />
              <KeyValueRow label={t('remoteServiceCurrentProcess')} value={status?.service.currentProcess ? t('yes') : t('no')} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" onClick={() => serviceMutation.mutate('start')} disabled={serviceMutation.isPending}>
                {t('remoteStartService')}
              </Button>
              <Button variant="outline" onClick={() => serviceMutation.mutate('restart')} disabled={serviceMutation.isPending}>
                {t('remoteRestartService')}
              </Button>
              <Button variant="outline" onClick={() => serviceMutation.mutate('stop')} disabled={serviceMutation.isPending}>
                {t('remoteStopService')}
              </Button>
            </div>
            <p className="text-xs text-gray-500">{t('remoteServiceHint')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {t('remoteDoctorTitle')}
          </CardTitle>
          <CardDescription>{t('remoteDoctorDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => doctorMutation.mutate()} disabled={doctorMutation.isPending}>
              <SquareTerminal className="mr-2 h-4 w-4" />
              {doctorMutation.isPending ? t('remoteDoctorRunning') : t('remoteRunDoctor')}
            </Button>
          </div>

          {doctorMutation.data ? (
            <div className="rounded-2xl border border-gray-200/70 bg-gray-50/70 px-4 py-3">
              <KeyValueRow label={t('remoteDoctorGeneratedAt')} value={formatDateTime(doctorMutation.data.generatedAt)} muted />
              <div className="mt-3 space-y-2">
                {doctorMutation.data.checks.map((check) => (
                  <div key={check.name} className="rounded-xl border border-white bg-white px-3 py-3">
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
        </CardContent>
      </Card>
    </PageLayout>
  );
}
