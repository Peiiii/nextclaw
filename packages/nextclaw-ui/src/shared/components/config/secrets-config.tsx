import { useConfig, useUpdateSecrets } from '@/hooks/useConfig';
import { t } from '@/lib/i18n';
import { buildSecretsFormState, buildSecretsSubmitPayload, SecretsConfigForm } from '@/shared/components/config/secrets-config-form';

export function SecretsConfig() {
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
