import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { desktopPresenceManager } from '@/desktop/managers/desktop-presence.manager';
import { useDesktopPresenceStore } from '@/desktop/stores/desktop-presence.store';
import { useRuntimeControl } from '@/hooks/use-runtime-control';
import { t } from '@/lib/i18n';

function PresenceHint(props: { title: string; description: string }) {
  const { description, title } = props;
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-gray-600">{description}</p>
    </div>
  );
}

export function RuntimePresenceCard() {
  const runtimeControlQuery = useRuntimeControl();
  const environment = runtimeControlQuery.data?.environment;
  const supported = useDesktopPresenceStore((state) => state.supported);
  const initialized = useDesktopPresenceStore((state) => state.initialized);
  const busyAction = useDesktopPresenceStore((state) => state.busyAction);
  const snapshot = useDesktopPresenceStore((state) => state.snapshot);

  useEffect(() => {
    if (environment === 'desktop-embedded') {
      void desktopPresenceManager.start();
      return;
    }
    desktopPresenceManager.markUnsupported();
  }, [environment]);

  if (environment === 'desktop-embedded') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('runtimePresenceTitle')}</CardTitle>
          <CardDescription>{t('runtimePresenceDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500">
              {t('runtimePresenceBehaviorLabel')}
            </p>
            <p className="mt-2 text-sm font-medium text-gray-900">
              {snapshot?.closeToBackground ? t('runtimePresenceBehaviorBackground') : t('runtimePresenceBehaviorQuit')}
            </p>
          </div>

          {!initialized || (supported && !snapshot) ? (
            <p className="text-sm text-gray-500">{t('runtimePresenceLoading')}</p>
          ) : null}

          {snapshot ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4">
                <div className="space-y-2">
                  <Label htmlFor="runtime-presence-close-background">{t('runtimePresenceCloseToBackground')}</Label>
                  <p className="text-sm text-gray-500">{t('runtimePresenceCloseToBackgroundHelp')}</p>
                </div>
                <Switch
                  id="runtime-presence-close-background"
                  aria-label={t('runtimePresenceCloseToBackground')}
                  checked={snapshot.closeToBackground}
                  disabled={busyAction === 'saving-preferences'}
                  onCheckedChange={(checked) => {
                    void desktopPresenceManager.updatePreferences({ closeToBackground: checked });
                  }}
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 p-4">
                <div className="space-y-2">
                  <Label htmlFor="runtime-presence-launch-login">{t('runtimePresenceLaunchAtLogin')}</Label>
                  <p className="text-sm text-gray-500">
                    {snapshot.supportsLaunchAtLogin
                      ? t('runtimePresenceLaunchAtLoginHelp')
                      : snapshot.launchAtLoginReason ?? t('runtimePresenceLaunchAtLoginUnavailable')}
                  </p>
                </div>
                <Switch
                  id="runtime-presence-launch-login"
                  aria-label={t('runtimePresenceLaunchAtLogin')}
                  checked={snapshot.launchAtLogin}
                  disabled={!snapshot.supportsLaunchAtLogin || busyAction === 'saving-preferences'}
                  onCheckedChange={(checked) => {
                    void desktopPresenceManager.updatePreferences({ launchAtLogin: checked });
                  }}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  if (environment === 'managed-local-service') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('runtimePresenceTitle')}</CardTitle>
          <CardDescription>{t('runtimePresenceDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <PresenceHint
            title={t('runtimePresenceManagedLocalTitle')}
            description={t('runtimePresenceManagedLocalDescription')}
          />
        </CardContent>
      </Card>
    );
  }

  if (environment === 'self-hosted-web') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('runtimePresenceTitle')}</CardTitle>
          <CardDescription>{t('runtimePresenceDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <PresenceHint
            title={t('runtimePresenceSelfHostedTitle')}
            description={t('runtimePresenceSelfHostedDescription')}
          />
        </CardContent>
      </Card>
    );
  }

  if (environment === 'shared-web') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('runtimePresenceTitle')}</CardTitle>
          <CardDescription>{t('runtimePresenceDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <PresenceHint
            title={t('runtimePresenceSharedTitle')}
            description={t('runtimePresenceSharedDescription')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('runtimePresenceTitle')}</CardTitle>
        <CardDescription>{t('runtimePresenceDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500">{t('runtimePresenceLoading')}</p>
      </CardContent>
    </Card>
  );
}
