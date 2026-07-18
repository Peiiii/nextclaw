import { SettingsPage } from '@/shared/components/settings/settings-page';
import { t } from '@/shared/lib/i18n';
import { RuntimeSecurityCard } from '@/features/system-status/components/runtime-security-card';

export function SecurityConfig() {
  return (
    <SettingsPage title={t('authSecurityTitle')} description={t('authSecurityDescription')}>
      <RuntimeSecurityCard />
    </SettingsPage>
  );
}
