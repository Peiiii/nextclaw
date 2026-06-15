import {
  normalizeThinkingLevels,
  parseThinkingLevel,
  type ModelThinkingCapability,
} from "./thinking.js";

export type ProviderModelConfigEntry = {
  thinking?: ModelThinkingCapability;
  vision?: boolean;
};

export type ProviderModelConfigMap = Record<string, ProviderModelConfigEntry>;

export function normalizeModelThinkingCapability(
  value: unknown,
): ModelThinkingCapability | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const supported = normalizeThinkingLevels(record.supported);
  if (supported.length === 0) {
    return null;
  }
  const defaultLevel = parseThinkingLevel(record.default);
  return {
    supported,
    default: defaultLevel && supported.includes(defaultLevel) ? defaultLevel : null,
  };
}

function stripProviderPrefix(model: string, providerName: string): string {
  const normalizedProvider = providerName.trim().toLowerCase();
  if (!normalizedProvider) {
    return model.trim();
  }
  const normalizedModel = model.trim();
  const normalizedModelLower = normalizedModel.toLowerCase();
  const prefix = `${normalizedProvider}/`;
  if (!normalizedModelLower.startsWith(prefix)) {
    return normalizedModel;
  }
  return normalizedModel.slice(prefix.length);
}

function buildModelLookupKeys(model: string, providerName?: string | null): Set<string> {
  const keys = new Set<string>();
  const normalizedModel = model.trim();
  if (!normalizedModel) {
    return keys;
  }
  keys.add(normalizedModel.toLowerCase());
  const slashIndex = normalizedModel.indexOf("/");
  if (slashIndex >= 0 && slashIndex + 1 < normalizedModel.length) {
    keys.add(normalizedModel.slice(slashIndex + 1).trim().toLowerCase());
  }
  if (providerName) {
    const localModel = stripProviderPrefix(normalizedModel, providerName);
    if (localModel) {
      keys.add(localModel.toLowerCase());
    }
  }
  return keys;
}

export function normalizeProviderModelConfig(
  input: Record<string, { thinking?: { supported?: unknown; default?: unknown } | null; vision?: unknown }> | null | undefined,
): ProviderModelConfigMap {
  if (!input || typeof input !== "object") {
    return {};
  }
  const normalized: ProviderModelConfigMap = {};
  for (const [rawModel, rawValue] of Object.entries(input)) {
    const model = rawModel.trim();
    if (!model || !rawValue || typeof rawValue !== "object") {
      continue;
    }
    const entry: ProviderModelConfigEntry = {};
    const supported = normalizeThinkingLevels(rawValue.thinking?.supported);
    const defaultLevel = parseThinkingLevel(rawValue.thinking?.default);
    if (supported.length > 0) {
      entry.thinking =
        defaultLevel && supported.includes(defaultLevel)
          ? { supported, default: defaultLevel }
          : { supported, default: null };
    }
    if (rawValue.vision === true) {
      entry.vision = true;
    }
    if (entry.thinking || entry.vision === true) {
      normalized[model] = entry;
    }
  }
  return normalized;
}

export function resolveProviderModelConfig(params: {
  model?: string | null;
  providerName?: string | null;
  modelConfig?: ProviderModelConfigMap | null;
}): ProviderModelConfigEntry | null {
  const { model: rawModel, providerName, modelConfig } = params;
  const model = typeof rawModel === "string" ? rawModel.trim() : "";
  if (!model || !modelConfig) {
    return null;
  }
  const lookupKeys = buildModelLookupKeys(model, providerName);
  if (lookupKeys.size === 0) {
    return null;
  }
  for (const [rawKey, entry] of Object.entries(modelConfig)) {
    const normalizedKey = rawKey.trim().toLowerCase();
    if (normalizedKey && lookupKeys.has(normalizedKey)) {
      return entry;
    }
  }
  return null;
}

export function resolveModelThinkingFromModelConfig(params: {
  model?: string | null;
  providerName?: string | null;
  modelConfig?: ProviderModelConfigMap | null;
}): ModelThinkingCapability | null {
  return resolveProviderModelConfig(params)?.thinking ?? null;
}

export function modelSupportsVision(params: {
  model?: string | null;
  providerName?: string | null;
  modelConfig?: ProviderModelConfigMap | null;
}): boolean {
  return resolveProviderModelConfig(params)?.vision === true;
}
