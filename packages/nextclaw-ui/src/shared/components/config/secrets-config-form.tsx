import { useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { PageHeader, PageLayout } from '@/app/components/layout/page-layout';
import type { SecretProviderView, SecretRefView, SecretSourceView, SecretsView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';
import { toast } from 'sonner';

type ProviderRow = {
  alias: string;
  source: SecretSourceView;
  prefix: string;
  path: string;
  command: string;
  argsText: string;
  cwd: string;
  timeoutMs: number;
};

type RefRow = {
  path: string;
  source: SecretSourceView;
  provider: string;
  id: string;
};

export type SecretsFormState = {
  enabled: boolean;
  defaultEnv: string;
  defaultFile: string;
  defaultExec: string;
  providers: ProviderRow[];
  refs: RefRow[];
};

const SOURCE_OPTIONS: SecretSourceView[] = ['env', 'file', 'exec'];

function createProviderRow(alias = ''): ProviderRow {
  return { alias, source: 'env', prefix: '', path: '', command: '', argsText: '', cwd: '', timeoutMs: 5000 };
}

function createRefRow(): RefRow {
  return { path: '', source: 'env', provider: '', id: '' };
}

function providerToRow(alias: string, provider: SecretProviderView): ProviderRow {
  if (provider.source === 'env') return { ...createProviderRow(alias), source: 'env', prefix: provider.prefix ?? '' };
  if (provider.source === 'file') return { ...createProviderRow(alias), source: 'file', path: provider.path };
  return {
    ...createProviderRow(alias),
    source: 'exec',
    command: provider.command,
    argsText: (provider.args ?? []).join('\n'),
    cwd: provider.cwd ?? '',
    timeoutMs: provider.timeoutMs ?? 5000,
  };
}

function rowToProvider(row: ProviderRow): SecretProviderView {
  if (row.source === 'env') return { source: 'env', ...(row.prefix.trim() ? { prefix: row.prefix.trim() } : {}) };
  if (row.source === 'file') return { source: 'file', path: row.path.trim(), format: 'json' };
  return {
    source: 'exec',
    command: row.command.trim(),
    args: row.argsText.split('\n').map((item) => item.trim()).filter(Boolean),
    ...(row.cwd.trim() ? { cwd: row.cwd.trim() } : {}),
    timeoutMs: Math.max(1, Math.trunc(row.timeoutMs || 5000)),
  };
}

export function buildSecretsFormState(secrets?: SecretsView): SecretsFormState {
  if (!secrets) {
    return { enabled: true, defaultEnv: '', defaultFile: '', defaultExec: '', providers: [], refs: [] };
  }
  return {
    enabled: Boolean(secrets.enabled),
    defaultEnv: secrets.defaults.env ?? '',
    defaultFile: secrets.defaults.file ?? '',
    defaultExec: secrets.defaults.exec ?? '',
    providers: Object.entries(secrets.providers).map(([alias, provider]) => providerToRow(alias, provider)),
    refs: Object.entries(secrets.refs).map(([path, ref]) => ({
      path,
      source: ref.source,
      provider: ref.provider ?? '',
      id: ref.id,
    })),
  };
}

export function buildSecretsSubmitPayload(state: SecretsFormState) {
  return {
    enabled: state.enabled,
    defaults: {
      env: state.defaultEnv || null,
      file: state.defaultFile || null,
      exec: state.defaultExec || null,
    },
    providers: Object.fromEntries(
      state.providers.map((row) => [row.alias.trim(), rowToProvider(row)]).filter(([alias]) => alias),
    ),
    refs: Object.fromEntries(
      state.refs.map((row) => [
        row.path.trim(),
        {
          source: row.source,
          ...(row.provider.trim() ? { provider: row.provider.trim() } : {}),
          id: row.id.trim(),
        },
      ]).filter(([path, ref]) => path && (ref as SecretRefView).id),
    ),
  };
}

function SecretsDefaultsCard(props: {
  defaultEnv: string;
  defaultFile: string;
  defaultExec: string;
  providerAliases: string[];
  onChange: (key: 'defaultEnv' | 'defaultFile' | 'defaultExec', value: string) => void;
}) {
  const { defaultEnv, defaultFile, defaultExec, providerAliases, onChange } = props;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('secrets')}</CardTitle>
        <CardDescription>{t('secretsEnabledHelp')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {[
          { label: t('defaultEnvProvider'), value: defaultEnv, key: 'defaultEnv' as const },
          { label: t('defaultFileProvider'), value: defaultFile, key: 'defaultFile' as const },
          { label: t('defaultExecProvider'), value: defaultExec, key: 'defaultExec' as const },
        ].map((item) => (
          <div key={item.key} className="space-y-2">
            <Label>{item.label}</Label>
            <Select value={item.value || '__none__'} onValueChange={(value) => onChange(item.key, value === '__none__' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder={t('noneOption')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('noneOption')}</SelectItem>
                {providerAliases.map((alias) => (
                  <SelectItem key={alias} value={alias}>
                    {alias}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{t('secretProvidersTitle')}</CardTitle>
        <CardDescription>{t('secretProvidersDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {providers.map((provider, index) => (
          <div key={`provider-${index}`} className="space-y-3 rounded-xl border border-gray-200 p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
              <Button type="button" variant="outline" onClick={() => onRemove(index)}>
                <Trash2 className="mr-2 h-4 w-4" />
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
              <div className="space-y-2">
                <Input value={provider.command} onChange={(event) => onUpdate(index, { command: event.target.value })} placeholder={t('secretExecCommand')} />
                <textarea
                  className="min-h-[84px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-mono"
                  value={provider.argsText}
                  onChange={(event) => onUpdate(index, { argsText: event.target.value })}
                  placeholder={t('secretExecArgs')}
                />
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Input value={provider.cwd} onChange={(event) => onUpdate(index, { cwd: event.target.value })} placeholder={t('secretExecCwd')} />
                  <Input
                    type="number"
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

        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addSecretProvider')}
        </Button>
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>{t('secretRefsTitle')}</CardTitle>
        <CardDescription>{t('secretRefsDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {refs.map((ref, index) => (
          <div key={`ref-${index}`} className="space-y-3 rounded-xl border border-gray-200 p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Select value={ref.provider || '__none__'} onValueChange={(value) => onUpdate(index, { provider: value === '__none__' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('secretProviderAlias')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('noneOption')}</SelectItem>
                    {providerAliases.map((alias) => (
                      <SelectItem key={alias} value={alias}>
                        {alias}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => onRemove(index)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {t('addSecretRef')}
        </Button>
      </CardContent>
    </Card>
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
      const providerMap: Record<string, SecretProviderView> = {};
      for (const [index, row] of state.providers.entries()) {
        const alias = row.alias.trim();
        if (!alias) throw new Error(`${t('providerAlias')} #${index + 1} ${t('isRequired')}`);
        if (providerMap[alias]) throw new Error(`${t('providerAlias')}: ${alias} (${t('duplicate')})`);
        if (row.source === 'file' && !row.path.trim()) throw new Error(`${t('secretFilePath')} #${index + 1} ${t('isRequired')}`);
        if (row.source === 'exec' && !row.command.trim()) throw new Error(`${t('secretExecCommand')} #${index + 1} ${t('isRequired')}`);
        providerMap[alias] = rowToProvider(row);
      }

      const refMap: Record<string, SecretRefView> = {};
      for (const [index, row] of state.refs.entries()) {
        const path = row.path.trim();
        const id = row.id.trim();
        if (!path) throw new Error(`${t('secretConfigPath')} #${index + 1} ${t('isRequired')}`);
        if (!id) throw new Error(`${t('secretId')} #${index + 1} ${t('isRequired')}`);
        const provider = row.provider.trim();
        if (provider && !providerMap[provider]) throw new Error(`${t('secretProviderAlias')}: ${provider} ${t('notFound')}`);
        refMap[path] = { source: row.source, ...(provider ? { provider } : {}), id };
      }

      onSubmit({
        enabled: state.enabled,
        defaultEnv: state.defaultEnv.trim(),
        defaultFile: state.defaultFile.trim(),
        defaultExec: state.defaultExec.trim(),
        providers: Object.entries(providerMap).map(([alias, provider]) => providerToRow(alias, provider)),
        refs: Object.entries(refMap).map(([path, ref]) => ({ path, source: ref.source, provider: ref.provider ?? '', id: ref.id })),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <PageLayout className="space-y-6">
      <PageHeader title={t('secretsPageTitle')} description={t('secretsPageDescription')} />
      <Card>
        <CardHeader>
          <CardTitle>{t('secrets')}</CardTitle>
          <CardDescription>{t('secretsEnabledHelp')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-gray-200 p-3">
            <div>
              <p className="text-sm font-medium text-gray-800">{t('enabled')}</p>
              <p className="text-xs text-gray-500">{t('secretsEnabledHelp')}</p>
            </div>
            <Switch checked={state.enabled} onCheckedChange={(enabled) => setState((prev) => ({ ...prev, enabled }))} />
          </div>
          <SecretsDefaultsCard
            defaultEnv={state.defaultEnv}
            defaultFile={state.defaultFile}
            defaultExec={state.defaultExec}
            providerAliases={providerAliases}
            onChange={(key, value) => setState((prev) => ({ ...prev, [key]: value }))}
          />
        </CardContent>
      </Card>
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
      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </PageLayout>
  );
}
