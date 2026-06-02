import { t } from '@/shared/lib/i18n';
import type { getLanguage } from '@/shared/lib/i18n';
import type { ProviderConfigUpdate, ProviderConfigView, ThinkingLevel } from '@/shared/lib/api';
import {
  normalizeModelConfigMap,
  normalizeThinkingLevels,
  parseThinkingLevel,
  THINKING_LEVELS,
  type ModelConfig as ModelConfigEntry
} from '@/shared/lib/provider-models';

type WireApiType = 'auto' | 'chat' | 'responses';
type ModelConfig = Record<string, ModelConfigEntry>;
type ProviderAuthMethodOption = {
  id: string;
};

const EMPTY_PROVIDER_CONFIG: ProviderConfigView = {
  providerId: '',
  providerType: null,
  isBuiltInType: false,
  isCustom: true,
  enabled: true,
  displayName: '',
  apiKeySet: false,
  apiKeyMasked: undefined,
  apiBase: null,
  extraHeaders: null,
  wireApi: null,
  models: [],
  modelConfig: {}
};

function normalizeHeaders(input: Record<string, string> | null | undefined): Record<string, string> | null {
  if (!input) {
    return null;
  }
  const entries = Object.entries(input)
    .map(([key, value]) => [key.trim(), value] as const)
    .filter(([key]) => key.length > 0);
  if (entries.length === 0) {
    return null;
  }
  return Object.fromEntries(entries);
}

function headersEqual(
  left: Record<string, string> | null | undefined,
  right: Record<string, string> | null | undefined
): boolean {
  const a = normalizeHeaders(left);
  const b = normalizeHeaders(right);
  if (a === null && b === null) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  const aEntries = Object.entries(a).sort(([ak], [bk]) => ak.localeCompare(bk));
  const bEntries = Object.entries(b).sort(([ak], [bk]) => ak.localeCompare(bk));
  if (aEntries.length !== bEntries.length) {
    return false;
  }
  return aEntries.every(([key, value], index) => key === bEntries[index][0] && value === bEntries[index][1]);
}

function normalizeModelList(input: string[] | null | undefined): string[] {
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

function stripProviderPrefix(model: string, prefix: string): string {
  const trimmed = model.trim();
  if (!trimmed || !prefix.trim()) {
    return trimmed;
  }
  const fullPrefix = `${prefix.trim()}/`;
  if (trimmed.startsWith(fullPrefix)) {
    return trimmed.slice(fullPrefix.length);
  }
  return trimmed;
}

function toProviderLocalModelId(model: string, aliases: string[]): string {
  let normalized = model.trim();
  if (!normalized) {
    return '';
  }
  for (const alias of aliases) {
    const cleanAlias = alias.trim();
    if (!cleanAlias) {
      continue;
    }
    normalized = stripProviderPrefix(normalized, cleanAlias);
  }
  return normalized.trim();
}

function modelListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, index) => item === right[index]);
}

function resolveEditableModels(defaultModels: string[], savedModels: string[]): string[] {
  void defaultModels;
  return normalizeModelList(savedModels);
}

function serializeModelsForSave(models: string[], providerId: string): string[] {
  const normalizedModels = normalizeModelList(models);
  return normalizedModels.map((model) => {
    const trimmed = model.trim();
    if (!trimmed || trimmed.startsWith(`${providerId}/`)) {
      return trimmed;
    }
    return `${providerId}/${trimmed}`;
  });
}

function applyEnabledPatch(payload: ProviderConfigUpdate, enabled: boolean, currentEnabled: boolean): void {
  if (enabled !== currentEnabled) {
    payload.enabled = enabled;
  }
}

function normalizeModelConfigForModels(modelConfig: ModelConfig, models: string[]): ModelConfig {
  const modelSet = new Set(models.map((item) => item.trim()).filter(Boolean));
  const normalized: ModelConfig = {};
  for (const [model, entry] of Object.entries(modelConfig)) {
    if (!modelSet.has(model)) {
      continue;
    }
    const nextEntry: NonNullable<ModelConfig[string]> = {};
    const supported = normalizeThinkingLevels(entry.thinking?.supported);
    if (supported.length > 0) {
      const defaultLevel = parseThinkingLevel(entry.thinking?.default);
      nextEntry.thinking =
        defaultLevel && supported.includes(defaultLevel)
          ? { supported, default: defaultLevel }
          : { supported };
    }
    if (entry.vision === true) {
      nextEntry.vision = true;
    }
    if (nextEntry.thinking || nextEntry.vision === true) {
      normalized[model] = nextEntry;
    }
  }
  return normalized;
}

function mergeModelConfig(
  base: ProviderConfigView['modelConfig'],
  override: ProviderConfigView['modelConfig'],
  aliases: string[]
): ModelConfig {
  return {
    ...normalizeModelConfigMap(base, aliases),
    ...normalizeModelConfigMap(override, aliases)
  };
}

function modelConfigEqual(left: ModelConfig, right: ModelConfig): boolean {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (let index = 0; index < leftKeys.length; index += 1) {
    const key = leftKeys[index];
    if (key !== rightKeys[index]) {
      return false;
    }
    const leftEntry = left[key];
    const rightEntry = right[key];
    if (!leftEntry || !rightEntry) {
      return false;
    }
    const leftSupported = [...(leftEntry.thinking?.supported ?? [])].sort();
    const rightSupported = [...(rightEntry.thinking?.supported ?? [])].sort();
    if (!modelListsEqual(leftSupported, rightSupported)) {
      return false;
    }
    if ((leftEntry.thinking?.default ?? null) !== (rightEntry.thinking?.default ?? null)) {
      return false;
    }
    if ((leftEntry.vision ?? false) !== (rightEntry.vision ?? false)) {
      return false;
    }
  }
  return true;
}

function formatThinkingLevelLabel(level: ThinkingLevel): string {
  if (level === 'off') {
    return t('chatThinkingLevelOff');
  }
  if (level === 'minimal') {
    return t('chatThinkingLevelMinimal');
  }
  if (level === 'low') {
    return t('chatThinkingLevelLow');
  }
  if (level === 'medium') {
    return t('chatThinkingLevelMedium');
  }
  if (level === 'high') {
    return t('chatThinkingLevelHigh');
  }
  if (level === 'adaptive') {
    return t('chatThinkingLevelAdaptive');
  }
  return t('chatThinkingLevelXhigh');
}

function resolvePreferredAuthMethodId(params: {
  providerName?: string;
  methods: ProviderAuthMethodOption[];
  defaultMethodId?: string;
  language: ReturnType<typeof getLanguage>;
}): string {
  const { providerName, methods, defaultMethodId, language } = params;
  if (methods.length === 0) {
    return '';
  }

  const methodIdMap = new Map<string, string>();
  for (const method of methods) {
    const methodId = method.id.trim();
    if (methodId) {
      methodIdMap.set(methodId.toLowerCase(), methodId);
    }
  }

  const pick = (...candidates: string[]): string | undefined => {
    for (const candidate of candidates) {
      const resolved = methodIdMap.get(candidate.toLowerCase());
      if (resolved) {
        return resolved;
      }
    }
    return undefined;
  };

  const normalizedDefault = defaultMethodId?.trim();
  if (providerName === 'minimax-portal') {
    if (language === 'zh') {
      return pick('cn', 'china-mainland') ?? pick(normalizedDefault ?? '') ?? methods[0]?.id ?? '';
    }
    if (language === 'en') {
      return pick('global', 'intl', 'international') ?? pick(normalizedDefault ?? '') ?? methods[0]?.id ?? '';
    }
  }

  if (normalizedDefault) {
    const matchedDefault = pick(normalizedDefault);
    if (matchedDefault) {
      return matchedDefault;
    }
  }

  if (language === 'zh') {
    return pick('cn') ?? methods[0]?.id ?? '';
  }
  if (language === 'en') {
    return pick('global') ?? methods[0]?.id ?? '';
  }

  return methods[0]?.id ?? '';
}

function shouldUsePillSelector(params: {
  required: boolean;
  hasDefault: boolean;
  optionCount: number;
}): boolean {
  const { required, hasDefault, optionCount } = params;
  return required && hasDefault && optionCount > 1 && optionCount <= 3;
}

export type { ModelConfig, ProviderAuthMethodOption, WireApiType };
export {
  applyEnabledPatch,
  EMPTY_PROVIDER_CONFIG,
  formatThinkingLevelLabel,
  headersEqual,
  modelListsEqual,
  modelConfigEqual,
  mergeModelConfig,
  normalizeHeaders,
  normalizeModelList,
  normalizeModelConfigForModels,
  resolveEditableModels,
  resolvePreferredAuthMethodId,
  serializeModelsForSave,
  shouldUsePillSelector,
  THINKING_LEVELS,
  toProviderLocalModelId
};
