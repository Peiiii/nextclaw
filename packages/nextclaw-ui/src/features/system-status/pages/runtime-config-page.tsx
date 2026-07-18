import { useConfig, useUpdateRuntime } from '@/shared/hooks/use-config';
import { RuntimeConfigEditor } from '@/features/system-status/components/config/runtime-config-editor';
import { t } from '@/shared/lib/i18n';
import { SettingsPage } from '@/shared/components/settings/settings-page';

export function RuntimeConfig() {
  const { data: config, isLoading } = useConfig();
  const updateRuntime = useUpdateRuntime();

  if (isLoading || !config) {
    return (
      <SettingsPage title={t('runtimePageTitle')} description={t('runtimePageDescription')}>
        <div className='text-sm text-muted-foreground'>{t('runtimeLoading')}</div>
      </SettingsPage>
    );
  }

  return <RuntimeConfigEditor config={config} updateRuntime={updateRuntime} />;
}
