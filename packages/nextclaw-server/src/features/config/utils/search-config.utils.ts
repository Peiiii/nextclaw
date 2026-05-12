import {
  ConfigSchema,
  hasSecretRef,
  loadConfig,
  saveConfig,
  type Config,
  type SearchConfig
} from "@nextclaw/core";
import type {
  BochaFreshnessValue,
  ConfigMetaView,
  ConfigView,
  SearchConfigUpdate,
  SearchProviderName,
  TavilySearchDepthValue
} from "@/shared/types/server-api.types.js";

const MASK_MIN_LENGTH = 8;
const BOCHA_OPEN_URL = "https://open.bocha.cn";
const TAVILY_DOCS_URL = "https://docs.tavily.com/documentation/api-reference/endpoint/search";
const SEARCH_PROVIDER_NAMES = ["bocha", "tavily", "brave"] as const;
type BochaSearchPatch = NonNullable<NonNullable<SearchConfigUpdate["providers"]>["bocha"]>;
type TavilySearchPatch = NonNullable<NonNullable<SearchConfigUpdate["providers"]>["tavily"]>;
type BraveSearchPatch = NonNullable<NonNullable<SearchConfigUpdate["providers"]>["brave"]>;

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function maskApiKey(value: string): { apiKeySet: boolean; apiKeyMasked?: string } {
  if (!value) {
    return { apiKeySet: false };
  }
  if (value.length < MASK_MIN_LENGTH) {
    return { apiKeySet: true, apiKeyMasked: "****" };
  }
  return {
    apiKeySet: true,
    apiKeyMasked: `${value.slice(0, 2)}****${value.slice(-4)}`
  };
}

function clearSecretRef(refs: Config["secrets"]["refs"], path: string): Config["secrets"]["refs"] {
  if (!refs[path]) {
    return refs;
  }
  const nextRefs = { ...refs };
  delete nextRefs[path];
  return nextRefs;
}

function isSearchProviderName(value: unknown): value is SearchProviderName {
  return typeof value === "string" && SEARCH_PROVIDER_NAMES.some((providerName) => providerName === value);
}

export const SEARCH_PROVIDER_META: ConfigMetaView["search"] = [
  {
    name: "bocha",
    displayName: "Bocha Search",
    description: "China-friendly web search with AI-ready summaries.",
    docsUrl: BOCHA_OPEN_URL,
    isDefault: true,
    supportsSummary: true
  },
  {
    name: "tavily",
    displayName: "Tavily Search",
    description: "Research-focused web search with optional synthesized answers.",
    docsUrl: TAVILY_DOCS_URL,
    supportsSummary: true
  },
  {
    name: "brave",
    displayName: "Brave Search",
    description: "Brave web search API kept as an optional provider.",
    supportsSummary: false
  }
];

function toSearchProviderView(
  config: Config,
  providerName: SearchProviderName,
  provider: SearchConfig["providers"][SearchProviderName]
): ConfigView["search"]["providers"]["bocha"] {
  const apiKeyPath = `search.providers.${providerName}.apiKey`;
  const apiKeyRefSet = hasSecretRef(config, apiKeyPath);
  const masked = maskApiKey(provider.apiKey);
  const view: ConfigView["search"]["providers"]["bocha"] = {
    enabled: config.search.enabledProviders.includes(providerName),
    apiKeySet: masked.apiKeySet || apiKeyRefSet,
    apiKeyMasked: masked.apiKeyMasked ?? (apiKeyRefSet ? "****" : undefined),
    baseUrl: provider.baseUrl
  };
  if ("docsUrl" in provider) {
    view.docsUrl = provider.docsUrl;
  }
  if ("summary" in provider) {
    view.summary = provider.summary;
  }
  if ("freshness" in provider) {
    view.freshness = provider.freshness as BochaFreshnessValue;
  }
  if ("searchDepth" in provider) {
    view.searchDepth = provider.searchDepth as TavilySearchDepthValue;
  }
  if ("includeAnswer" in provider) {
    view.includeAnswer = Boolean(provider.includeAnswer);
  }
  return view;
}

export function buildSearchView(config: Config): ConfigView["search"] {
  return {
    provider: config.search.provider,
    enabledProviders: [...config.search.enabledProviders],
    defaults: {
      maxResults: config.search.defaults.maxResults
    },
    providers: {
      bocha: toSearchProviderView(config, "bocha", config.search.providers.bocha),
      tavily: toSearchProviderView(config, "tavily", config.search.providers.tavily),
      brave: toSearchProviderView(config, "brave", config.search.providers.brave)
    }
  };
}

function replaceSearchConfig(
  config: Config,
  search: SearchConfig,
  refs: Config["secrets"]["refs"] = config.secrets.refs
): Config {
  return {
    ...config,
    search,
    secrets: refs === config.secrets.refs ? config.secrets : { ...config.secrets, refs }
  };
}

function applyActiveSearchProviderPatch(config: Config, provider: SearchConfigUpdate["provider"]): Config {
  if (!isSearchProviderName(provider)) {
    return config;
  }
  return replaceSearchConfig(config, { ...config.search, provider });
}

function applyEnabledSearchProvidersPatch(config: Config, enabledProviders: SearchConfigUpdate["enabledProviders"]): Config {
  if (!Array.isArray(enabledProviders)) {
    return config;
  }
  const nextEnabledProviders = Array.from(new Set(
    enabledProviders.filter((value): value is SearchProviderName => isSearchProviderName(value))
  ));
  return replaceSearchConfig(config, { ...config.search, enabledProviders: nextEnabledProviders });
}

function applySearchDefaultsPatch(config: Config, defaults: SearchConfigUpdate["defaults"]): Config {
  if (!defaults || !Object.prototype.hasOwnProperty.call(defaults, "maxResults")) {
    return config;
  }
  const nextMaxResults = defaults.maxResults;
  if (typeof nextMaxResults === "number" && Number.isFinite(nextMaxResults)) {
    return replaceSearchConfig(config, {
      ...config.search,
      defaults: {
        ...config.search.defaults,
        maxResults: Math.max(1, Math.min(50, Math.trunc(nextMaxResults)))
      }
    });
  }
  return config;
}

function applyBochaSearchPatch(config: Config, patch: BochaSearchPatch | undefined): Config {
  if (!patch) {
    return config;
  }
  let nextRefs = config.secrets.refs;
  let nextProvider = config.search.providers.bocha;
  if (Object.prototype.hasOwnProperty.call(patch, "apiKey")) {
    nextProvider = { ...nextProvider, apiKey: patch.apiKey ?? "" };
    nextRefs = clearSecretRef(nextRefs, "search.providers.bocha.apiKey");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "baseUrl")) {
    nextProvider = {
      ...nextProvider,
      baseUrl: normalizeOptionalString(patch.baseUrl) ?? "https://api.bocha.cn/v1/web-search"
    };
  }
  if (Object.prototype.hasOwnProperty.call(patch, "docsUrl")) {
    nextProvider = {
      ...nextProvider,
      docsUrl: normalizeOptionalString(patch.docsUrl) ?? BOCHA_OPEN_URL
    };
  }
  if (Object.prototype.hasOwnProperty.call(patch, "summary")) {
    nextProvider = { ...nextProvider, summary: Boolean(patch.summary) };
  }
  if (Object.prototype.hasOwnProperty.call(patch, "freshness")) {
    const freshness = normalizeOptionalString(patch.freshness);
    nextProvider = {
      ...nextProvider,
      freshness:
        freshness === "noLimit" ||
        freshness === "oneDay" ||
        freshness === "oneWeek" ||
        freshness === "oneMonth" ||
        freshness === "oneYear"
          ? freshness
          : "noLimit"
    };
  }
  return replaceSearchConfig(
    config,
    {
      ...config.search,
      providers: { ...config.search.providers, bocha: nextProvider }
    },
    nextRefs
  );
}

function applyTavilySearchPatch(config: Config, patch: TavilySearchPatch | undefined): Config {
  if (!patch) {
    return config;
  }
  let nextRefs = config.secrets.refs;
  let nextProvider = config.search.providers.tavily;
  if (Object.prototype.hasOwnProperty.call(patch, "apiKey")) {
    nextProvider = { ...nextProvider, apiKey: patch.apiKey ?? "" };
    nextRefs = clearSecretRef(nextRefs, "search.providers.tavily.apiKey");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "baseUrl")) {
    nextProvider = {
      ...nextProvider,
      baseUrl: normalizeOptionalString(patch.baseUrl) ?? "https://api.tavily.com/search"
    };
  }
  if (Object.prototype.hasOwnProperty.call(patch, "searchDepth")) {
    const searchDepth = normalizeOptionalString(patch.searchDepth);
    nextProvider = {
      ...nextProvider,
      searchDepth: searchDepth === "advanced" ? "advanced" : "basic"
    };
  }
  if (Object.prototype.hasOwnProperty.call(patch, "includeAnswer")) {
    nextProvider = { ...nextProvider, includeAnswer: Boolean(patch.includeAnswer) };
  }
  return replaceSearchConfig(
    config,
    {
      ...config.search,
      providers: { ...config.search.providers, tavily: nextProvider }
    },
    nextRefs
  );
}

function applyBraveSearchPatch(config: Config, patch: BraveSearchPatch | undefined): Config {
  if (!patch) {
    return config;
  }
  let nextRefs = config.secrets.refs;
  let nextProvider = config.search.providers.brave;
  if (Object.prototype.hasOwnProperty.call(patch, "apiKey")) {
    nextProvider = { ...nextProvider, apiKey: patch.apiKey ?? "" };
    nextRefs = clearSecretRef(nextRefs, "search.providers.brave.apiKey");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "baseUrl")) {
    nextProvider = {
      ...nextProvider,
      baseUrl: normalizeOptionalString(patch.baseUrl) ?? "https://api.search.brave.com/res/v1/web/search"
    };
  }
  return replaceSearchConfig(
    config,
    {
      ...config.search,
      providers: { ...config.search.providers, brave: nextProvider }
    },
    nextRefs
  );
}

export function updateSearch(configPath: string, patch: SearchConfigUpdate): ConfigView["search"] {
  const config = loadConfig(configPath);
  const nextConfig = applyBraveSearchPatch(
    applyTavilySearchPatch(
      applyBochaSearchPatch(
        applySearchDefaultsPatch(
          applyEnabledSearchProvidersPatch(
            applyActiveSearchProviderPatch(config, patch.provider),
            patch.enabledProviders
          ),
          patch.defaults
        ),
        patch.providers?.bocha
      ),
      patch.providers?.tavily
    ),
    patch.providers?.brave
  );
  const next = ConfigSchema.parse(nextConfig);
  saveConfig(next, configPath);
  return buildSearchView(next);
}
