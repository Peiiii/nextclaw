import type { ConfigView, ProviderConfigView, ProviderTemplateView, ProvidersView, ProviderTemplatesView, ThinkingLevel } from '@/shared/lib/api';

export const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'adaptive', 'xhigh'];
const THINKING_LEVEL_SET = new Set<string>(THINKING_LEVELS);

export type ModelThinkingCapability = {
  supported: ThinkingLevel[];
  default?: ThinkingLevel | null;
};

export type ModelConfig = {
  thinking?: ModelThinkingCapability;
  vision?: boolean;
};

export type ProviderModelCatalogItem = {
  name: string;
  displayName: string;
  prefix: string;
  aliases: string[];
  models: string[];
  modelConfig: Record<string, ModelConfig>;
  modelThinking: Record<string, ModelThinkingCapability>;
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

export function resolveModelsWithDefaults(defaultModels: string[], savedModels: string[]): string[] {
  const normalizedSavedModels = normalizeStringList(savedModels);
  if (normalizedSavedModels.length > 0) {
    return normalizedSavedModels;
  }
  return normalizeStringList(defaultModels);
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

export function parseThinkingLevel(value: unknown): ThinkingLevel | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return THINKING_LEVEL_SET.has(normalized) ? (normalized as ThinkingLevel) : null;
}

export function normalizeThinkingLevels(values: unknown): ThinkingLevel[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const deduped: ThinkingLevel[] = [];
  for (const value of values) {
    const level = parseThinkingLevel(value);
    if (!level || deduped.includes(level)) {
      continue;
    }
    deduped.push(level);
  }
  return deduped;
}

export function normalizeModelConfigMap(
  input: ProviderConfigView['modelConfig'],
  aliases: string[]
): Record<string, ModelConfig> {
  if (!input) {
    return {};
  }
  const normalized: Record<string, ModelConfig> = {};
  for (const [rawModel, rawValue] of Object.entries(input)) {
    const localModel = toProviderLocalModel(rawModel, aliases);
    if (!localModel) {
      continue;
    }
    const entry: ModelConfig = {};
    const supported = normalizeThinkingLevels(rawValue?.thinking?.supported);
    if (supported.length > 0) {
      const defaultLevel = parseThinkingLevel(rawValue?.thinking?.default);
      entry.thinking =
        defaultLevel && supported.includes(defaultLevel)
          ? { supported, default: defaultLevel }
          : { supported };
    }
    if (rawValue?.vision === true) {
      entry.vision = true;
    }
    if (entry.thinking || entry.vision === true) {
      normalized[localModel] = entry;
    }
  }
  return normalized;
}

function extractModelThinkingMap(
  modelConfig: Record<string, ModelConfig>
): Record<string, ModelThinkingCapability> {
  return Object.fromEntries(
    Object.entries(modelConfig)
      .filter((entry): entry is [string, ModelConfig & { thinking: ModelThinkingCapability }] =>
        Boolean(entry[1].thinking))
      .map(([model, entry]) => [model, entry.thinking])
  );
}

export function resolveModelThinkingCapability(
  map: Record<string, ModelThinkingCapability>,
  model: string,
  aliases: string[]
): ModelThinkingCapability | null {
  const localModel = toProviderLocalModel(model, aliases);
  if (!localModel) {
    return null;
  }
  return map[localModel] ?? null;
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
  // Keep in sync with ProvidersList "已配置" tab: only enabled providers with apiKey count as configured.
  return provider.enabled !== false && provider.apiKeySet === true;
}

export function buildProviderModelCatalog(params: {
  providersView?: ProvidersView;
  templatesView?: ProviderTemplatesView;
  config?: ConfigView;
  onlyConfigured?: boolean;
}): ProviderModelCatalogItem[] {
  const { providersView, templatesView, config, onlyConfigured = false } = params;
  const templateByType = new Map((templatesView?.providerTemplates ?? []).map((template) => [template.providerType, template]));
  const providerEntries = Object.values(providersView?.providers ?? config?.providers ?? {});

  const catalog = providerEntries.map((providerConfig) => {
    const { providerId } = providerConfig;
    const template: ProviderTemplateView | undefined = providerConfig.providerType
      ? templateByType.get(providerConfig.providerType)
      : undefined;
    const prefix = providerId.trim();
    const aliases = normalizeStringList([providerId, template?.modelPrefix || '', template?.providerType || '']);
    const savedModels = normalizeStringList(
      (providerConfig?.models ?? []).map((model) => toProviderLocalModel(model, aliases))
    );
    const models = savedModels;
    const modelConfig = {
      ...normalizeModelConfigMap(template?.modelConfig, aliases),
      ...normalizeModelConfigMap(providerConfig?.modelConfig, aliases)
    };
    const modelThinking = extractModelThinkingMap(modelConfig);
    const configDisplayName = providerConfig?.displayName?.trim();
    const configured = isProviderConfigured(providerConfig);

    return {
      name: providerId,
      displayName: configDisplayName || template?.displayName || providerId,
      prefix,
      aliases,
      models,
      modelConfig,
      modelThinking,
      configured
    } satisfies ProviderModelCatalogItem;
  });

  if (!onlyConfigured) {
    return catalog;
  }

  return catalog.filter((provider) => provider.configured && provider.models.length > 0);
}
