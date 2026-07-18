import { type ReactNode, useEffect } from 'react';
import { NoticeCard } from '@/shared/components/feedback/notice-card';
import { SettingRow, SettingsGroup, SettingsSection } from '@/shared/components/settings/setting-row';
import { Switch } from '@/shared/components/ui/switch';
import { desktopPresenceManager, useDesktopPresenceStore } from '@/platforms/desktop';
import { useSystemStatus } from '@/features/system-status';
import { t } from '@/shared/lib/i18n';

function PresenceHint(props: { title: string; description: string }) {
  const { description, title } = props;
  return <NoticeCard tone='neutral' title={title} description={description} />;
}

function PresenceCardFrame(props: { children: ReactNode }) {
  const { children } = props;
  return (
    <SettingsSection title={t('runtimePresenceTitle')} description={t('runtimePresenceDescription')}>
      <SettingsGroup>{children}</SettingsGroup>
    </SettingsSection>
  );
}

export function RuntimePresenceCard() {
  const systemStatus = useSystemStatus();
  const environment = systemStatus.runtimeControlView?.environment;
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
      <PresenceCardFrame>
        <div className='p-4'>
          <NoticeCard
            tone='neutral'
            title={t('runtimePresenceBehaviorLabel')}
            description={
              snapshot?.closeToBackground ? t('runtimePresenceBehaviorBackground') : t('runtimePresenceBehaviorQuit')
            }
            className='rounded-xl'
          />
        </div>

        {!initialized || (supported && !snapshot) ? (
          <p className='p-4 text-sm text-muted-foreground'>{t('runtimePresenceLoading')}</p>
        ) : null}

        {snapshot ? (
          <>
            <SettingRow
              title={t('runtimePresenceCloseToBackground')}
              description={t('runtimePresenceCloseToBackgroundHelp')}
              control={
                <Switch
                  id='runtime-presence-close-background'
                  aria-label={t('runtimePresenceCloseToBackground')}
                  checked={snapshot.closeToBackground}
                  disabled={busyAction === 'saving-preferences'}
                  onCheckedChange={(checked) => {
                    void desktopPresenceManager.updatePreferences({
                      closeToBackground: checked
                    });
                  }}
                />
              }
            />

            <SettingRow
              title={t('runtimePresenceLaunchAtLogin')}
              description={
                snapshot.supportsLaunchAtLogin
                  ? t('runtimePresenceLaunchAtLoginHelp')
                  : (snapshot.launchAtLoginReason ?? t('runtimePresenceLaunchAtLoginUnavailable'))
              }
              control={
                <Switch
                  id='runtime-presence-launch-login'
                  aria-label={t('runtimePresenceLaunchAtLogin')}
                  checked={snapshot.launchAtLogin}
                  disabled={!snapshot.supportsLaunchAtLogin || busyAction === 'saving-preferences'}
                  onCheckedChange={(checked) => {
                    void desktopPresenceManager.updatePreferences({
                      launchAtLogin: checked
                    });
                  }}
                />
              }
            />
          </>
        ) : null}
      </PresenceCardFrame>
    );
  }

  if (environment === 'managed-local-service') {
    return (
      <PresenceCardFrame>
        <div className='p-4'>
          <PresenceHint
            title={t('runtimePresenceManagedLocalTitle')}
            description={t('runtimePresenceManagedLocalDescription')}
          />
        </div>
      </PresenceCardFrame>
    );
  }

  if (environment === 'self-hosted-web') {
    return (
      <PresenceCardFrame>
        <div className='p-4'>
          <PresenceHint
            title={t('runtimePresenceSelfHostedTitle')}
            description={t('runtimePresenceSelfHostedDescription')}
          />
        </div>
      </PresenceCardFrame>
    );
  }

  if (environment === 'shared-web') {
    return (
      <PresenceCardFrame>
        <div className='p-4'>
          <PresenceHint title={t('runtimePresenceSharedTitle')} description={t('runtimePresenceSharedDescription')} />
        </div>
      </PresenceCardFrame>
    );
  }

  return (
    <PresenceCardFrame>
      <p className='p-4 text-sm text-muted-foreground'>{t('runtimePresenceLoading')}</p>
    </PresenceCardFrame>
  );
}
