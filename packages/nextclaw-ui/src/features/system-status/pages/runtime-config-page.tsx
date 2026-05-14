import { useConfig, useUpdateRuntime } from '@/shared/hooks/use-config';
import { RuntimeConfigEditor } from '@/features/system-status/components/config/runtime-config-editor';
import { t } from '@/shared/lib/i18n';

export function RuntimeConfig() {
  const { data: config, isLoading } = useConfig();
  const updateRuntime = useUpdateRuntime();

  if (isLoading || !config) {
    return <div className="p-8 text-gray-400">{t('runtimeLoading')}</div>;
  }

  return <RuntimeConfigEditor config={config} updateRuntime={updateRuntime} />;
}
