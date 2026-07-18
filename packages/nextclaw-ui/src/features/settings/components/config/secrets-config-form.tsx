import { useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { FormActions } from '@/shared/components/ui/actions/form-actions';
import { SettingRow, SettingsGroup, SettingsSection } from '@/shared/components/settings/setting-row';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { SettingsPage } from '@/shared/components/settings/settings-page';
import type { SecretSourceView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';
import { toast } from 'sonner';
import {
  SOURCE_OPTIONS,
  createProviderRow,
  createRefRow,
  prepareSecretsFormSubmitState,
  type ProviderRow,
  type RefRow,
  type SecretsFormState,
} from '@/features/settings/utils/secrets-config-form.utils';

function SecretsDefaultRows(props: {
  defaultEnv: string;
  defaultFile: string;
  defaultExec: string;
  providerAliases: string[];
  onChange: (key: 'defaultEnv' | 'defaultFile' | 'defaultExec', value: string) => void;
}) {
  const { defaultEnv, defaultFile, defaultExec, providerAliases, onChange } = props;
  return (
    <>
      {[
        { label: t('defaultEnvProvider'), value: defaultEnv, key: 'defaultEnv' as const },
        { label: t('defaultFileProvider'), value: defaultFile, key: 'defaultFile' as const },
        { label: t('defaultExecProvider'), value: defaultExec, key: 'defaultExec' as const },
      ].map((item) => (
        <SettingRow
          key={item.key}
          title={item.label}
          control={
            <Select value={item.value || '__none__'} onValueChange={(value) => onChange(item.key, value === '__none__' ? '' : value)}>
              <SelectTrigger className='w-56'>
                <SelectValue placeholder={t('noneOption')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='__none__'>{t('noneOption')}</SelectItem>
                {providerAliases.map((alias) => (
                  <SelectItem key={alias} value={alias}>
                    {alias}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      ))}
    </>
  );
}

function SecretsProvidersCard(props: {
  providers: ProviderRow[];
  onUpdate: (index: number, patch: Partial<ProviderRow>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const { providers, onUpdate, onRemove, onAdd } = props;
  return (
    <SettingsSection
      title={t('secretProvidersTitle')}
      description={t('secretProvidersDescription')}
      actions={
        <Button type='button' variant='ghost' size='sm' onClick={onAdd}>
          <Plus className='mr-2 h-4 w-4' />
          {t('addSecretProvider')}
        </Button>
      }
    >
      <SettingsGroup>
        {providers.map((provider, index) => (
          <div key={`provider-${index}`} className='space-y-3 p-4'>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
              <Input value={provider.alias} onChange={(event) => onUpdate(index, { alias: event.target.value })} placeholder={t('providerAlias')} />
              <Select value={provider.source} onValueChange={(value) => onUpdate(index, { source: value as SecretSourceView })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type='button' variant='outline' onClick={() => onRemove(index)}>
                <Trash2 className='mr-2 h-4 w-4' />
                {t('removeProvider')}
              </Button>
            </div>

            {provider.source === 'env' ? (
              <Input value={provider.prefix} onChange={(event) => onUpdate(index, { prefix: event.target.value })} placeholder={t('envPrefix')} />
            ) : null}
            {provider.source === 'file' ? (
              <Input value={provider.path} onChange={(event) => onUpdate(index, { path: event.target.value })} placeholder={t('secretFilePath')} />
            ) : null}
            {provider.source === 'exec' ? (
              <div className='space-y-2'>
                <Input value={provider.command} onChange={(event) => onUpdate(index, { command: event.target.value })} placeholder={t('secretExecCommand')} />
                <textarea
                  className='min-h-[84px] w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs'
                  value={provider.argsText}
                  onChange={(event) => onUpdate(index, { argsText: event.target.value })}
                  placeholder={t('secretExecArgs')}
                />
                <div className='grid grid-cols-1 gap-2 md:grid-cols-2'>
                  <Input value={provider.cwd} onChange={(event) => onUpdate(index, { cwd: event.target.value })} placeholder={t('secretExecCwd')} />
                  <Input
                    type='number'
                    min={1}
                    value={provider.timeoutMs}
                    onChange={(event) => onUpdate(index, { timeoutMs: Number.parseInt(event.target.value, 10) || 5000 })}
                    placeholder={t('secretExecTimeoutMs')}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </SettingsGroup>
    </SettingsSection>
  );
}

function SecretsRefsCard(props: {
  refs: RefRow[];
  providerAliases: string[];
  onUpdate: (index: number, patch: Partial<RefRow>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const { refs, providerAliases, onUpdate, onRemove, onAdd } = props;
  return (
    <SettingsSection
      title={t('secretRefsTitle')}
      description={t('secretRefsDescription')}
      actions={
        <Button type='button' variant='ghost' size='sm' onClick={onAdd}>
          <Plus className='mr-2 h-4 w-4' />
          {t('addSecretRef')}
        </Button>
      }
    >
      <SettingsGroup>
        {refs.map((ref, index) => (
          <div key={`ref-${index}`} className='space-y-3 p-4'>
            <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
              <Input value={ref.path} onChange={(event) => onUpdate(index, { path: event.target.value })} placeholder={t('secretConfigPath')} />
              <Input value={ref.id} onChange={(event) => onUpdate(index, { id: event.target.value })} placeholder={t('secretId')} />
              <Select value={ref.source} onValueChange={(value) => onUpdate(index, { source: value as SecretSourceView })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className='grid grid-cols-[1fr_auto] gap-2'>
                <Select value={ref.provider || '__none__'} onValueChange={(value) => onUpdate(index, { provider: value === '__none__' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('secretProviderAlias')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='__none__'>{t('noneOption')}</SelectItem>
                    {providerAliases.map((alias) => (
                      <SelectItem key={alias} value={alias}>
                        {alias}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type='button' variant='outline' onClick={() => onRemove(index)}>
                  <Trash2 className='h-4 w-4' />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </SettingsGroup>
    </SettingsSection>
  );
}

export function SecretsConfigForm(props: {
  initialState: SecretsFormState;
  isPending: boolean;
  onSubmit: (state: SecretsFormState) => void;
}) {
  const { initialState, isPending, onSubmit } = props;
  const [state, setState] = useState(initialState);
  const providerAliases = useMemo(() => {
    const aliases = state.providers.map((item) => item.alias.trim()).filter(Boolean);
    return Array.from(new Set(aliases));
  }, [state.providers]);

  const updateProvider = (index: number, patch: Partial<ProviderRow>) => {
    setState((prev) => ({
      ...prev,
      providers: prev.providers.map((entry, cursor) => (cursor === index ? { ...entry, ...patch } : entry)),
    }));
  };

  const updateRef = (index: number, patch: Partial<RefRow>) => {
    setState((prev) => ({
      ...prev,
      refs: prev.refs.map((entry, cursor) => (cursor === index ? { ...entry, ...patch } : entry)),
    }));
  };

  const handleSave = () => {
    try {
      onSubmit(prepareSecretsFormSubmitState(state));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <SettingsPage title={t('secretsPageTitle')} description={t('secretsPageDescription')}>
      <SettingsSection title={t('secrets')} description={t('secretsEnabledHelp')}>
        <SettingsGroup>
          <SettingRow
            title={t('enabled')}
            description={t('secretsEnabledHelp')}
            control={
              <Switch
                checked={state.enabled}
                onCheckedChange={(enabled) => setState((prev) => ({ ...prev, enabled }))}
              />
            }
          />
          <SecretsDefaultRows
            defaultEnv={state.defaultEnv}
            defaultFile={state.defaultFile}
            defaultExec={state.defaultExec}
            providerAliases={providerAliases}
            onChange={(key, value) => setState((prev) => ({ ...prev, [key]: value }))}
          />
        </SettingsGroup>
      </SettingsSection>
      <SecretsProvidersCard
        providers={state.providers}
        onUpdate={updateProvider}
        onRemove={(index) => setState((prev) => ({ ...prev, providers: prev.providers.filter((_, cursor) => cursor !== index) }))}
        onAdd={() => setState((prev) => ({ ...prev, providers: [...prev.providers, createProviderRow()] }))}
      />
      <SecretsRefsCard
        refs={state.refs}
        providerAliases={providerAliases}
        onUpdate={updateRef}
        onRemove={(index) => setState((prev) => ({ ...prev, refs: prev.refs.filter((_, cursor) => cursor !== index) }))}
        onAdd={() => setState((prev) => ({ ...prev, refs: [...prev.refs, createRefRow()] }))}
      />
      <FormActions>
        <Button type='button' size='sm' onClick={handleSave} disabled={isPending}>
          <Save className='mr-1.5 h-3.5 w-3.5' />
          {isPending ? t('saving') : t('save')}
        </Button>
      </FormActions>
    </SettingsPage>
  );
}
