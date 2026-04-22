import { t } from '@/shared/lib/i18n';
import type { getLanguage } from '@/shared/lib/i18n';
import type { ProviderConfigUpdate, ProviderConfigView, ThinkingLevel } from '@/shared/lib/api';

type WireApiType = 'auto' | 'chat' | 'responses';
type ModelThinkingConfig = Record<string, { supported: ThinkingLevel[]; default?: ThinkingLevel | null }>;
type ProviderAuthMethodOption = {
  id: string;
};

const EMPTY_PROVIDER_CONFIG: ProviderConfigView = {
  enabled: true,
  displayName: '',
  apiKeySet: false,
  apiKeyMasked: undefined,
  apiBase: null,
  extraHeaders: null,
  wireApi: null,
  models: [],
  modelThinking: {}
};

const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'adaptive', 'xhigh'];
const THINKING_LEVEL_SET = new Set<string>(THINKING_LEVELS);

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

function mergeModelLists(base: string[], extra: string[]): string[] {
  const merged = [...base];
  for (const item of extra) {
    if (!merged.includes(item)) {
      merged.push(item);
    }
  }
  return merged;
}

function resolveEditableModels(defaultModels: string[], savedModels: string[]): string[] {
  if (savedModels.length === 0) {
    return defaultModels;
  }
  const looksLikeLegacyCustomList = savedModels.every((model) => !defaultModels.includes(model));
  if (looksLikeLegacyCustomList) {
    return mergeModelLists(defaultModels, savedModels);
  }
  return savedModels;
}

function serializeModelsForSave(models: string[], defaultModels: string[]): string[] {
  if (modelListsEqual(models, defaultModels)) {
    return [];
  }
  return models;
}

function applyEnabledPatch(payload: ProviderConfigUpdate, enabled: boolean, currentEnabled: boolean): void {
  if (enabled !== currentEnabled) {
    payload.enabled = enabled;
  }
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

function normalizeModelThinkingConfig(
  input: ProviderConfigView['modelThinking'],
  aliases: string[]
): ModelThinkingConfig {
  if (!input) {
    return {};
  }
  const normalized: ModelThinkingConfig = {};
  for (const [rawModel, rawValue] of Object.entries(input)) {
    const model = toProviderLocalModelId(rawModel, aliases);
    if (!model) {
      continue;
    }
    const supported = normalizeThinkingLevels(rawValue?.supported);
    if (supported.length === 0) {
      continue;
    }
    const defaultLevel = parseThinkingLevel(rawValue?.default);
    normalized[model] =
      defaultLevel && supported.includes(defaultLevel)
        ? { supported, default: defaultLevel }
        : { supported };
  }
  return normalized;
}

function normalizeModelThinkingForModels(modelThinking: ModelThinkingConfig, models: string[]): ModelThinkingConfig {
  const modelSet = new Set(models.map((item) => item.trim()).filter(Boolean));
  const normalized: ModelThinkingConfig = {};
  for (const [model, entry] of Object.entries(modelThinking)) {
    if (!modelSet.has(model)) {
      continue;
    }
    const supported = normalizeThinkingLevels(entry.supported);
    if (supported.length === 0) {
      continue;
    }
    const defaultLevel = parseThinkingLevel(entry.default);
    normalized[model] =
      defaultLevel && supported.includes(defaultLevel)
        ? { supported, default: defaultLevel }
        : { supported };
  }
  return normalized;
}

function modelThinkingEqual(left: ModelThinkingConfig, right: ModelThinkingConfig): boolean {
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
    const leftSupported = [...leftEntry.supported].sort();
    const rightSupported = [...rightEntry.supported].sort();
    if (!modelListsEqual(leftSupported, rightSupported)) {
      return false;
    }
    if ((leftEntry.default ?? null) !== (rightEntry.default ?? null)) {
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
  return params.required && params.hasDefault && params.optionCount > 1 && params.optionCount <= 3;
}

export type { ModelThinkingConfig, ProviderAuthMethodOption, WireApiType };
export {
  applyEnabledPatch,
  EMPTY_PROVIDER_CONFIG,
  formatThinkingLevelLabel,
  headersEqual,
  modelListsEqual,
  modelThinkingEqual,
  normalizeHeaders,
  normalizeModelList,
  normalizeModelThinkingConfig,
  normalizeModelThinkingForModels,
  resolveEditableModels,
  resolvePreferredAuthMethodId,
  serializeModelsForSave,
  shouldUsePillSelector,
  THINKING_LEVELS,
  toProviderLocalModelId
};
