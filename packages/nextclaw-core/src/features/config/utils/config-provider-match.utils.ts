import { findProviderByName, listProviderSpecs } from "@core/features/llm-providers/index.js";
import type { Config, ProviderConfig } from "@core/features/config/configs/config-schema.config.js";

function buildProviderAliasList(name: string, modelPrefix?: string | null): string[] {
  const aliases = new Set<string>();
  const normalizedName = name.trim().toLowerCase();
  if (normalizedName) {
    aliases.add(normalizedName);
  }
  const normalizedPrefix = modelPrefix?.trim().toLowerCase();
  if (normalizedPrefix) {
    aliases.add(normalizedPrefix);
  }
  return [...aliases];
}

function matchExplicitPrefixedProvider(params: {
  providers: Record<string, ProviderConfig>;
  providerSpecs: ReturnType<typeof listProviderSpecs>;
  modelPrefix: string;
}): { provider: ProviderConfig | null; name: string | null } | null {
  const { providers, providerSpecs, modelPrefix } = params;
  for (const spec of providerSpecs) {
    const provider = providers[spec.name];
    if (!provider) {
      continue;
    }
    if (!buildProviderAliasList(spec.name, spec.modelPrefix).includes(modelPrefix)) {
      continue;
    }
    return provider.enabled !== false ? { provider, name: spec.name } : { provider: null, name: null };
  }
  for (const [name, provider] of Object.entries(providers)) {
    if (name.toLowerCase() !== modelPrefix) {
      continue;
    }
    return provider.enabled !== false ? { provider, name } : { provider: null, name: null };
  }
  return null;
}

function matchBuiltinKeywordProvider(params: {
  providers: Record<string, ProviderConfig>;
  providerSpecs: ReturnType<typeof listProviderSpecs>;
  modelLower: string;
}): { provider: ProviderConfig | null; name: string | null } | null {
  const { providers, providerSpecs, modelLower } = params;
  const keywordMatches: Array<{ provider: ProviderConfig; name: string }> = [];
  for (const spec of providerSpecs) {
    const provider = providers[spec.name];
    if (!provider || provider.enabled === false || !provider.apiKey) {
      continue;
    }
    if (!spec.keywords.some((kw) => modelLower.includes(kw))) {
      continue;
    }
    keywordMatches.push({ provider, name: spec.name });
  }
  if (keywordMatches.length === 1) {
    return keywordMatches[0] ?? { provider: null, name: null };
  }
  if (keywordMatches.length > 1) {
    return { provider: null, name: null };
  }
  return null;
}

function matchSingleEnabledBuiltinProvider(params: {
  providers: Record<string, ProviderConfig>;
  providerSpecs: ReturnType<typeof listProviderSpecs>;
}): { provider: ProviderConfig; name: string } | null {
  const { providers, providerSpecs } = params;
  const enabledProviders = providerSpecs
    .map((spec) => ({ provider: providers[spec.name], name: spec.name }))
    .filter((entry): entry is { provider: ProviderConfig; name: string } => Boolean(entry.provider))
    .filter((entry) => entry.provider.enabled !== false && Boolean(entry.provider.apiKey));
  return enabledProviders.length === 1 ? enabledProviders[0] ?? null : null;
}

function matchSingleEnabledCustomProvider(params: {
  providers: Record<string, ProviderConfig>;
  providerSpecs: ReturnType<typeof listProviderSpecs>;
}): { provider: ProviderConfig; name: string } | null {
  const builtinProviderNames = new Set(params.providerSpecs.map((spec) => spec.name));
  const enabledCustomProviders = Object.entries(params.providers)
    .filter(([name]) => !builtinProviderNames.has(name))
    .filter(([, provider]) => provider.enabled !== false && Boolean(provider.apiKey));
  if (enabledCustomProviders.length !== 1) {
    return null;
  }
  const [name, provider] = enabledCustomProviders[0];
  return { provider, name };
}

export function matchProvider(config: Config, model?: string): { provider: ProviderConfig | null; name: string | null } {
  const providers = config.providers as Record<string, ProviderConfig>;
  const providerSpecs = listProviderSpecs();
  const rawModel = String(model ?? config.agents.defaults.model ?? "").trim();
  const modelLower = rawModel.toLowerCase();
  const modelPrefix = modelLower.includes("/") ? modelLower.slice(0, modelLower.indexOf("/")) : "";
  if (modelPrefix) {
    const prefixedMatch = matchExplicitPrefixedProvider({
      providers,
      providerSpecs,
      modelPrefix,
    });
    if (prefixedMatch) {
      return prefixedMatch;
    }
  }

  const keywordMatch = matchBuiltinKeywordProvider({
    providers,
    providerSpecs,
    modelLower,
  });
  if (keywordMatch) {
    return keywordMatch;
  }

  const singleBuiltinProvider = matchSingleEnabledBuiltinProvider({
    providers,
    providerSpecs,
  });
  if (singleBuiltinProvider) {
    return singleBuiltinProvider;
  }

  const singleCustomProvider = matchSingleEnabledCustomProvider({
    providers,
    providerSpecs,
  });
  if (singleCustomProvider) {
    return singleCustomProvider;
  }
  return { provider: null, name: null };
}

export function getProvider(config: Config, model?: string): ProviderConfig | null {
  return matchProvider(config, model).provider;
}

export function getProviderName(config: Config, model?: string): string | null {
  return matchProvider(config, model).name;
}

export function getApiKey(config: Config, model?: string): string | null {
  const provider = getProvider(config, model);
  return provider?.apiKey ?? null;
}

export function getApiBase(config: Config, model?: string): string | null {
  const { provider, name } = matchProvider(config, model);
  if (provider?.apiBase) {
    return provider.apiBase;
  }
  if (name) {
    const spec = findProviderByName(name);
    if (spec?.defaultApiBase) {
      return spec.defaultApiBase;
    }
  }
  return null;
}
