import { useConfig, useUpdateSecrets } from '@/shared/hooks/use-config';
import { t } from '@/shared/lib/i18n';
import { SecretsConfigForm } from '@/features/settings/components/config/secrets-config-form';
import { buildSecretsFormState, buildSecretsSubmitPayload } from '@/features/settings/utils/secrets-config-form.utils';

export function SecretsConfigPage() {
  const { data: config, isLoading } = useConfig();
  const updateSecrets = useUpdateSecrets();

  if (isLoading) {
    return <div className="p-8 text-gray-400">{t('loading')}</div>;
  }

  return (
    <SecretsConfigForm
      key={JSON.stringify(config?.secrets ?? null)}
      initialState={buildSecretsFormState(config?.secrets)}
      isPending={updateSecrets.isPending}
      onSubmit={(state) =>
        updateSecrets.mutate({
          data: buildSecretsSubmitPayload(state),
        })
      }
    />
  );
}
