import type { ConfigMetaView, ConfigView, ProviderConfigView } from '@/api/types';

export type ProviderModelCatalogItem = {
  name: string;
  displayName: string;
  prefix: string;
  aliases: string[];
  models: string[];
  configured: boolean;
};

export function normalizeStringList(input: string[] | null | undefined): string[] {
  if (!input || input.length === 0) {
    return [];
  }
  const deduped = new Set<string>();
  for (const item of input) {
    const trimmed = item.trim();
    if (trimmed) {
      deduped.add(trimmed);
    }
  }
  return [...deduped];
}

export function stripProviderPrefix(model: string, prefix: string): string {
  const trimmed = model.trim();
  const cleanPrefix = prefix.trim();
  if (!trimmed || !cleanPrefix) {
    return trimmed;
  }
  const withSlash = `${cleanPrefix}/`;
  if (trimmed.startsWith(withSlash)) {
    return trimmed.slice(withSlash.length);
  }
  return trimmed;
}

export function toProviderLocalModel(model: string, aliases: string[]): string {
  let normalized = model.trim();
  if (!normalized) {
    return '';
  }
  for (const alias of aliases) {
    normalized = stripProviderPrefix(normalized, alias);
  }
  return normalized.trim();
}

export function composeProviderModel(prefix: string, localModel: string): string {
  const normalizedModel = localModel.trim();
  const normalizedPrefix = prefix.trim();
  if (!normalizedModel) {
    return '';
  }
  if (!normalizedPrefix) {
    return normalizedModel;
  }
  return `${normalizedPrefix}/${normalizedModel}`;
}

export function findProviderByModel(
  model: string,
  providerCatalog: Array<{ name: string; aliases: string[]; models?: string[] }>
): string | null {
  const trimmed = model.trim();
  if (!trimmed) {
    return null;
  }
  let bestMatch: { name: string; score: number } | null = null;
  for (const provider of providerCatalog) {
    for (const alias of provider.aliases) {
      const cleanAlias = alias.trim();
      if (!cleanAlias) {
        continue;
      }
      if (trimmed === cleanAlias || trimmed.startsWith(`${cleanAlias}/`)) {
        if (!bestMatch || cleanAlias.length > bestMatch.score) {
          bestMatch = { name: provider.name, score: cleanAlias.length };
        }
      }
    }
  }
  if (bestMatch) {
    return bestMatch.name;
  }
  for (const provider of providerCatalog) {
    const normalizedModel = toProviderLocalModel(trimmed, provider.aliases);
    if (!normalizedModel) {
      continue;
    }
    const models = normalizeStringList(provider.models ?? []);
    if (models.some((modelId) => modelId === normalizedModel)) {
      return provider.name;
    }
  }
  return null;
}

function isProviderConfigured(provider: ProviderConfigView | undefined): boolean {
  if (!provider) {
    return false;
  }
  // Keep in sync with ProvidersList "已配置" tab: only apiKeySet counts as configured.
  return provider.apiKeySet === true;
}

export function buildProviderModelCatalog(params: {
  meta?: ConfigMetaView;
  config?: ConfigView;
  onlyConfigured?: boolean;
}): ProviderModelCatalogItem[] {
  const { meta, config, onlyConfigured = false } = params;

  const catalog = (meta?.providers ?? []).map((spec) => {
    const providerConfig = config?.providers?.[spec.name];
    const prefix = (spec.modelPrefix || spec.name || '').trim();
    const aliases = normalizeStringList([spec.modelPrefix || '', spec.name || '']);
    const defaultModels = normalizeStringList((spec.defaultModels ?? []).map((model) => toProviderLocalModel(model, aliases)));
    const customModels = normalizeStringList(
      (providerConfig?.models ?? []).map((model) => toProviderLocalModel(model, aliases))
    );
    const models = normalizeStringList([...defaultModels, ...customModels]);
    const configDisplayName = providerConfig?.displayName?.trim();
    const configured = isProviderConfigured(providerConfig);

    return {
      name: spec.name,
      displayName: configDisplayName || spec.displayName || spec.name,
      prefix,
      aliases,
      models,
      configured
    } satisfies ProviderModelCatalogItem;
  });

  if (!onlyConfigured) {
    return catalog;
  }

  return catalog.filter((provider) => provider.configured && provider.models.length > 0);
}
