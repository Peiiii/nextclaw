import { useEffect, useMemo, useState } from 'react';
import { useConfig, useUpdateSecrets } from '@/hooks/useConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PageHeader, PageLayout } from '@/components/layout/page-layout';
import type { SecretProviderView, SecretRefView, SecretSourceView } from '@/api/types';
import { t } from '@/lib/i18n';
import { Plus, Save, Trash2 } from 'lucide-react';
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

const SOURCE_OPTIONS: SecretSourceView[] = ['env', 'file', 'exec'];

function createProviderRow(alias = ''): ProviderRow {
  return {
    alias,
    source: 'env',
    prefix: '',
    path: '',
    command: '',
    argsText: '',
    cwd: '',
    timeoutMs: 5000
  };
}

function createRefRow(): RefRow {
  return {
    path: '',
    source: 'env',
    provider: '',
    id: ''
  };
}

function providerToRow(alias: string, provider: SecretProviderView): ProviderRow {
  if (provider.source === 'env') {
    return {
      ...createProviderRow(alias),
      source: 'env',
      prefix: provider.prefix ?? ''
    };
  }

  if (provider.source === 'file') {
    return {
      ...createProviderRow(alias),
      source: 'file',
      path: provider.path
    };
  }

  return {
    ...createProviderRow(alias),
    source: 'exec',
    command: provider.command,
    argsText: (provider.args ?? []).join('\n'),
    cwd: provider.cwd ?? '',
    timeoutMs: provider.timeoutMs ?? 5000
  };
}

function rowToProvider(row: ProviderRow): SecretProviderView {
  if (row.source === 'env') {
    return {
      source: 'env',
      ...(row.prefix.trim() ? { prefix: row.prefix.trim() } : {})
    };
  }

  if (row.source === 'file') {
    return {
      source: 'file',
      path: row.path.trim(),
      format: 'json'
    };
  }

  return {
    source: 'exec',
    command: row.command.trim(),
    args: row.argsText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
    ...(row.cwd.trim() ? { cwd: row.cwd.trim() } : {}),
    timeoutMs: Math.max(1, Math.trunc(row.timeoutMs || 5000))
  };
}

export function SecretsConfig() {
  const { data: config, isLoading } = useConfig();
  const updateSecrets = useUpdateSecrets();

  const [enabled, setEnabled] = useState(true);
  const [defaultEnv, setDefaultEnv] = useState('');
  const [defaultFile, setDefaultFile] = useState('');
  const [defaultExec, setDefaultExec] = useState('');
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [refs, setRefs] = useState<RefRow[]>([]);

  useEffect(() => {
    const secrets = config?.secrets;
    if (!secrets) {
      setEnabled(true);
      setDefaultEnv('');
      setDefaultFile('');
      setDefaultExec('');
      setProviders([]);
      setRefs([]);
      return;
    }

    setEnabled(Boolean(secrets.enabled));
    setDefaultEnv(secrets.defaults.env ?? '');
    setDefaultFile(secrets.defaults.file ?? '');
    setDefaultExec(secrets.defaults.exec ?? '');

    const nextProviders = Object.entries(secrets.providers).map(([alias, provider]) =>
      providerToRow(alias, provider)
    );
    const nextRefs = Object.entries(secrets.refs).map(([path, ref]) => ({
      path,
      source: ref.source,
      provider: ref.provider ?? '',
      id: ref.id
    }));

    setProviders(nextProviders);
    setRefs(nextRefs);
  }, [config?.secrets]);

  const providerAliases = useMemo(() => {
    const aliases = providers
      .map((item) => item.alias.trim())
      .filter(Boolean);
    return Array.from(new Set(aliases));
  }, [providers]);

  const updateProvider = (index: number, patch: Partial<ProviderRow>) => {
    setProviders((prev) => prev.map((entry, cursor) => (cursor === index ? { ...entry, ...patch } : entry)));
  };

  const updateRef = (index: number, patch: Partial<RefRow>) => {
    setRefs((prev) => prev.map((entry, cursor) => (cursor === index ? { ...entry, ...patch } : entry)));
  };

  const handleSave = () => {
    try {
      const providerMap: Record<string, SecretProviderView> = {};
      for (const [index, row] of providers.entries()) {
        const alias = row.alias.trim();
        if (!alias) {
          throw new Error(`${t('providerAlias')} #${index + 1} ${t('isRequired')}`);
        }

        if (providerMap[alias]) {
          throw new Error(`${t('providerAlias')}: ${alias} (${t('duplicate')})`);
        }

        if (row.source === 'file' && !row.path.trim()) {
          throw new Error(`${t('secretFilePath')} #${index + 1} ${t('isRequired')}`);
        }

        if (row.source === 'exec' && !row.command.trim()) {
          throw new Error(`${t('secretExecCommand')} #${index + 1} ${t('isRequired')}`);
        }

        providerMap[alias] = rowToProvider(row);
      }

      const refMap: Record<string, SecretRefView> = {};
      for (const [index, row] of refs.entries()) {
        const path = row.path.trim();
        const id = row.id.trim();
        if (!path) {
          throw new Error(`${t('secretConfigPath')} #${index + 1} ${t('isRequired')}`);
        }
        if (!id) {
          throw new Error(`${t('secretId')} #${index + 1} ${t('isRequired')}`);
        }

        const provider = row.provider.trim();
        if (provider && !providerMap[provider]) {
          throw new Error(`${t('secretProviderAlias')}: ${provider} ${t('notFound')}`);
        }

        refMap[path] = {
          source: row.source,
          ...(provider ? { provider } : {}),
          id
        };
      }

      updateSecrets.mutate({
        data: {
          enabled,
          defaults: {
            env: defaultEnv.trim() || null,
            file: defaultFile.trim() || null,
            exec: defaultExec.trim() || null
          },
          providers: providerMap,
          refs: refMap
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-gray-400">{t('loading')}</div>;
  }

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
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>{t('defaultEnvProvider')}</Label>
              <Select value={defaultEnv || '__none__'} onValueChange={(value) => setDefaultEnv(value === '__none__' ? '' : value)}>
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

            <div className="space-y-2">
              <Label>{t('defaultFileProvider')}</Label>
              <Select value={defaultFile || '__none__'} onValueChange={(value) => setDefaultFile(value === '__none__' ? '' : value)}>
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

            <div className="space-y-2">
              <Label>{t('defaultExecProvider')}</Label>
              <Select value={defaultExec || '__none__'} onValueChange={(value) => setDefaultExec(value === '__none__' ? '' : value)}>
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('secretProvidersTitle')}</CardTitle>
          <CardDescription>{t('secretProvidersDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {providers.map((provider, index) => (
            <div key={`provider-${index}`} className="rounded-xl border border-gray-200 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input
                  value={provider.alias}
                  onChange={(event) => updateProvider(index, { alias: event.target.value })}
                  placeholder={t('providerAlias')}
                />
                <Select value={provider.source} onValueChange={(value) => updateProvider(index, { source: value as SecretSourceView })}>
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
                <Button type="button" variant="outline" onClick={() => setProviders((prev) => prev.filter((_, i) => i !== index))}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('removeProvider')}
                </Button>
              </div>

              {provider.source === 'env' && (
                <Input
                  value={provider.prefix}
                  onChange={(event) => updateProvider(index, { prefix: event.target.value })}
                  placeholder={t('envPrefix')}
                />
              )}

              {provider.source === 'file' && (
                <Input
                  value={provider.path}
                  onChange={(event) => updateProvider(index, { path: event.target.value })}
                  placeholder={t('secretFilePath')}
                />
              )}

              {provider.source === 'exec' && (
                <div className="space-y-2">
                  <Input
                    value={provider.command}
                    onChange={(event) => updateProvider(index, { command: event.target.value })}
                    placeholder={t('secretExecCommand')}
                  />
                  <textarea
                    className="min-h-[84px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-mono"
                    value={provider.argsText}
                    onChange={(event) => updateProvider(index, { argsText: event.target.value })}
                    placeholder={t('secretExecArgs')}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Input
                      value={provider.cwd}
                      onChange={(event) => updateProvider(index, { cwd: event.target.value })}
                      placeholder={t('secretExecCwd')}
                    />
                    <Input
                      type="number"
                      min={1}
                      value={provider.timeoutMs}
                      onChange={(event) => updateProvider(index, { timeoutMs: Number.parseInt(event.target.value, 10) || 5000 })}
                      placeholder={t('secretExecTimeoutMs')}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          <Button type="button" variant="outline" onClick={() => setProviders((prev) => [...prev, createProviderRow()])}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addSecretProvider')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('secretRefsTitle')}</CardTitle>
          <CardDescription>{t('secretRefsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {refs.map((ref, index) => (
            <div key={`ref-${index}`} className="rounded-xl border border-gray-200 p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  value={ref.path}
                  onChange={(event) => updateRef(index, { path: event.target.value })}
                  placeholder={t('secretConfigPath')}
                />
                <Input
                  value={ref.id}
                  onChange={(event) => updateRef(index, { id: event.target.value })}
                  placeholder={t('secretId')}
                />
                <Select value={ref.source} onValueChange={(value) => updateRef(index, { source: value as SecretSourceView })}>
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
                  <Select
                    value={ref.provider || '__none__'}
                    onValueChange={(value) => updateRef(index, { provider: value === '__none__' ? '' : value })}
                  >
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
                  <Button type="button" variant="outline" onClick={() => setRefs((prev) => prev.filter((_, i) => i !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" onClick={() => setRefs((prev) => [...prev, createRefRow()])}>
            <Plus className="h-4 w-4 mr-2" />
            {t('addSecretRef')}
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={updateSecrets.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateSecrets.isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </PageLayout>
  );
}
