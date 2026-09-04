import { SettingsPage } from '@/shared/components/settings/settings-page';
import { Switch } from '@/shared/components/ui/switch';
import { t } from '@/shared/lib/i18n';
import { RuntimeSecurityCard } from '@/features/system-status/components/runtime-security-card';
import { useAccountLoginEnabled } from '@/features/account/hooks/use-account-login-enabled';

export function SecurityConfig() {
  const { enabled: accountLoginEnabled, setEnabled: setAccountLoginEnabled } = useAccountLoginEnabled();

  return (
    <SettingsPage title={t('authSecurityTitle')} description={t('authSecurityDescription')}>
      <div className='rounded-xl border border-border/55 bg-card/40 p-4'>
        <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
          <div className='space-y-1'>
            <p className='text-sm font-medium text-foreground'>{t('accountLoginToggleTitle')}</p>
            <p className='text-xs text-muted-foreground'>{t('accountLoginToggleDescription')}</p>
          </div>
          <Switch
            id='account-login-enabled'
            aria-label={t('accountLoginToggleTitle')}
            checked={accountLoginEnabled}
            onCheckedChange={(checked) => setAccountLoginEnabled(checked)}
          />
        </div>
      </div>
      <RuntimeSecurityCard />
    </SettingsPage>
  );
}
