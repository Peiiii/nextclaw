import type { ConfigMetaView, ConfigView, ProviderConfigView, ThinkingLevel } from '@/shared/lib/api';

const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'adaptive', 'xhigh'];
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

function parseThinkingLevel(value: unknown): ThinkingLevel | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return THINKING_LEVEL_SET.has(normalized) ? (normalized as ThinkingLevel) : null;
}

function normalizeThinkingLevels(values: unknown): ThinkingLevel[] {
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

export function normalizeModelThinkingMap(
  input: ProviderConfigView['modelConfig'],
  aliases: string[]
): Record<string, ModelThinkingCapability> {
  const modelConfig = normalizeModelConfigMap(input, aliases);
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
  meta?: ConfigMetaView;
  config?: ConfigView;
  onlyConfigured?: boolean;
}): ProviderModelCatalogItem[] {
  const { meta, config, onlyConfigured = false } = params;

  const catalog = (meta?.providers ?? []).map((spec) => {
    const providerConfig = config?.providers?.[spec.name];
    const prefix = (spec.modelPrefix || spec.name || '').trim();
    const aliases = normalizeStringList([spec.modelPrefix || '', spec.name || '']);
    const models = normalizeStringList(
      (providerConfig?.models ?? []).map((model) => toProviderLocalModel(model, aliases))
    );
    const rawModelConfig = providerConfig?.modelConfig ?? spec.modelConfig;
    const modelConfig = normalizeModelConfigMap(rawModelConfig, aliases);
    const modelThinking = normalizeModelThinkingMap(rawModelConfig, aliases);
    const configDisplayName = providerConfig?.displayName?.trim();
    const configured = isProviderConfigured(providerConfig);

    return {
      name: spec.name,
      displayName: configDisplayName || spec.displayName || spec.name,
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
