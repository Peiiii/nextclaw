export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "adaptive", "xhigh"] as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[number];
export type ModelThinkingCapability = {
  supported: ThinkingLevel[];
  default: ThinkingLevel | null;
};

const THINKING_LEVEL_SET = new Set<string>(THINKING_LEVELS);

export const CLEAR_THINKING_TOKENS = new Set(["clear", "reset", "default", "auto", "unset"]);

export function parseThinkingLevel(value: unknown): ThinkingLevel | null {
  if (typeof value !== "string") {
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
  const modelLower = normalizedModel.toLowerCase();
  keys.add(modelLower);
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

export function resolveModelThinkingCapability(params: {
  model?: string | null;
  providerName?: string | null;
  capabilities?: Record<string, { supported?: unknown; default?: unknown }> | null;
}): ModelThinkingCapability | null {
  const model = typeof params.model === "string" ? params.model.trim() : "";
  if (!model || !params.capabilities) {
    return null;
  }

  const lookupKeys = buildModelLookupKeys(model, params.providerName);
  if (lookupKeys.size === 0) {
    return null;
  }

  for (const [rawKey, rawValue] of Object.entries(params.capabilities)) {
    const normalizedKey = rawKey.trim().toLowerCase();
    if (!normalizedKey || !lookupKeys.has(normalizedKey)) {
      continue;
    }
    const supported = normalizeThinkingLevels(rawValue?.supported);
    const defaultLevel = parseThinkingLevel(rawValue?.default);
    if (supported.length === 0 && !defaultLevel) {
      return null;
    }
    return {
      supported,
      default: defaultLevel
    };
  }

  return null;
}

export function resolveEffectiveThinkingLevel(
  requested: ThinkingLevel,
  capability: ModelThinkingCapability | null | undefined
): ThinkingLevel {
  if (requested === "off") {
    return "off";
  }
  if (!capability || capability.supported.length === 0) {
    return requested;
  }
  if (capability.supported.includes(requested)) {
    return requested;
  }
  if (capability.default && capability.supported.includes(capability.default)) {
    return capability.default;
  }
  return "off";
}

export function mapThinkingLevelToOpenAIReasoningEffort(
  thinkingLevel: ThinkingLevel | null | undefined
): "minimal" | "low" | "medium" | "high" | undefined {
  if (!thinkingLevel || thinkingLevel === "off") {
    return undefined;
  }
  if (thinkingLevel === "adaptive") {
    return "medium";
  }
  if (thinkingLevel === "xhigh") {
    return "high";
  }
  if (thinkingLevel === "minimal" || thinkingLevel === "low" || thinkingLevel === "medium" || thinkingLevel === "high") {
    return thinkingLevel;
  }
  return undefined;
}
