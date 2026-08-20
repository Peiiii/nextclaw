import { SettingsPage } from '@/shared/components/settings/settings-page';
import { SettingRow, SettingsGroup, SettingsSection } from '@/shared/components/settings/setting-row';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useConfig, useUpdateProductAnalytics } from '@/shared/hooks/use-config';
import type { ProductAnalyticsAudience } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

export function PrivacySettingsPage(): JSX.Element {
  const configQuery = useConfig();
  const updateMutation = useUpdateProductAnalytics();
  const enabled = configQuery.data?.productAnalytics.enabled ?? false;
  const audience = configQuery.data?.productAnalytics.audience ?? 'external';

  const updateEnabled = (nextEnabled: boolean) => {
    updateMutation.mutate({ data: { enabled: nextEnabled } });
  };
  const updateAudience = (nextAudience: string) => {
    const value = nextAudience as ProductAnalyticsAudience;
    updateMutation.mutate({ data: { audience: value } });
  };

  return (
    <SettingsPage title={t('privacyPageTitle')} description={t('privacyPageDescription')}>
      <SettingsSection title={t('productAnalyticsSectionTitle')} description={t('productAnalyticsSectionDescription')}>
        <SettingsGroup>
          <SettingRow
            title={t('productAnalyticsEnabledTitle')}
            description={t('productAnalyticsEnabledDescription')}
            control={(
              <Switch
                aria-label={t('productAnalyticsEnabledTitle')}
                checked={enabled}
                disabled={configQuery.isLoading || updateMutation.isPending}
                onCheckedChange={updateEnabled}
              />
            )}
          />
          <SettingRow
            title={t('productAnalyticsAudienceTitle')}
            description={t('productAnalyticsAudienceDescription')}
            control={(
              <Select
                value={audience}
                onValueChange={updateAudience}
                disabled={configQuery.isLoading || updateMutation.isPending}
              >
                <SelectTrigger aria-label={t('productAnalyticsAudienceTitle')} className='w-40 sm:w-48'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='external'>{t('productAnalyticsAudienceExternal')}</SelectItem>
                  <SelectItem value='internal'>{t('productAnalyticsAudienceInternal')}</SelectItem>
                  <SelectItem value='qa'>{t('productAnalyticsAudienceQa')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title={t('productAnalyticsDataTitle')}>
        <SettingsGroup>
          <SettingRow
            layout='stacked'
            title={t('productAnalyticsCollectedTitle')}
            description={t('productAnalyticsCollectedDescription')}
          />
          <SettingRow
            layout='stacked'
            title={t('productAnalyticsExcludedTitle')}
            description={t('productAnalyticsExcludedDescription')}
          />
          <SettingRow
            layout='stacked'
            title={t('productAnalyticsAnonymousTitle')}
            description={t('productAnalyticsAnonymousDescription')}
          />
        </SettingsGroup>
      </SettingsSection>
    </SettingsPage>
  );
}
