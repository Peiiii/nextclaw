import type { SecretProviderView, SecretRefView, SecretSourceView, SecretsView } from '@/shared/lib/api';
import { t } from '@/shared/lib/i18n';

export type ProviderRow = {
  alias: string;
  source: SecretSourceView;
  prefix: string;
  path: string;
  command: string;
  argsText: string;
  cwd: string;
  timeoutMs: number;
};

export type RefRow = {
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

export const SOURCE_OPTIONS: SecretSourceView[] = ['env', 'file', 'exec'];

export function createProviderRow(alias = ''): ProviderRow {
  return { alias, source: 'env', prefix: '', path: '', command: '', argsText: '', cwd: '', timeoutMs: 5000 };
}

export function createRefRow(): RefRow {
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

export function prepareSecretsFormSubmitState(state: SecretsFormState): SecretsFormState {
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

  return {
    enabled: state.enabled,
    defaultEnv: state.defaultEnv.trim(),
    defaultFile: state.defaultFile.trim(),
    defaultExec: state.defaultExec.trim(),
    providers: Object.entries(providerMap).map(([alias, provider]) => providerToRow(alias, provider)),
    refs: Object.entries(refMap).map(([path, ref]) => ({ path, source: ref.source, provider: ref.provider ?? '', id: ref.id })),
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
