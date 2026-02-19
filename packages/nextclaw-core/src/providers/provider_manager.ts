import type { Config, ProviderConfig } from "../config/schema.js";
import { getApiBase, getProvider, getProviderName } from "../config/schema.js";
import type { LLMProvider, LLMResponse } from "./base.js";
import { LiteLLMProvider } from "./litellm_provider.js";

type ProviderManagerOptions = {
  defaultProvider: LLMProvider;
  config?: Config;
};

type ProviderRoute = {
  model: string;
  providerName: string | null;
  provider: ProviderConfig | null;
  apiBase: string | null;
};

type ProviderChatParams = {
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  model?: string | null;
  maxTokens?: number;
};

const normalizedModel = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const headersFingerprint = (headers: Record<string, string> | null | undefined): string => {
  if (!headers) {
    return "";
  }
  const sortedEntries = Object.entries(headers).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(sortedEntries);
};

export class ProviderManager {
  private defaultProvider: LLMProvider;
  private config?: Config;
  private providerPool = new Map<string, LLMProvider>();

  constructor(options: ProviderManagerOptions | LLMProvider) {
    if ("defaultProvider" in options) {
      this.defaultProvider = options.defaultProvider;
      this.config = options.config;
    } else {
      this.defaultProvider = options;
    }
  }

  get(model?: string | null): LLMProvider {
    const route = this.resolveRoute(model);
    if (!route) {
      return this.defaultProvider;
    }
    return this.getOrCreateProvider(route);
  }

  set(next: LLMProvider): void {
    this.defaultProvider = next;
  }

  setConfig(nextConfig: Config): void {
    this.config = nextConfig;
    this.providerPool.clear();
  }

  async chat(params: ProviderChatParams): Promise<LLMResponse> {
    const provider = this.get(params.model ?? null);
    return provider.chat(params);
  }

  private resolveRoute(model?: string | null): ProviderRoute | null {
    if (!this.config) {
      return null;
    }

    const effectiveModel = normalizedModel(model) ?? this.config.agents.defaults.model;
    const provider = getProvider(this.config, effectiveModel);
    const providerName = getProviderName(this.config, effectiveModel);
    const apiBase = getApiBase(this.config, effectiveModel);
    return {
      model: effectiveModel,
      providerName,
      provider,
      apiBase
    };
  }

  private getOrCreateProvider(route: ProviderRoute): LLMProvider {
    const routeProvider = route.provider;
    if (!routeProvider?.apiKey && !route.model.startsWith("bedrock/")) {
      return this.defaultProvider;
    }

    const cacheKey = this.buildCacheKey(route);
    const cached = this.providerPool.get(cacheKey);
    if (cached) {
      return cached;
    }

    const created = new LiteLLMProvider({
      apiKey: routeProvider?.apiKey ?? null,
      apiBase: route.apiBase,
      defaultModel: route.model,
      extraHeaders: routeProvider?.extraHeaders ?? null,
      providerName: route.providerName,
      wireApi: routeProvider?.wireApi ?? null
    });
    this.providerPool.set(cacheKey, created);
    return created;
  }

  private buildCacheKey(route: ProviderRoute): string {
    const routeProvider = route.provider;
    return [
      route.providerName ?? "",
      routeProvider?.apiKey ?? "",
      route.apiBase ?? "",
      routeProvider?.wireApi ?? "",
      headersFingerprint(routeProvider?.extraHeaders ?? null)
    ].join("||");
  }
}
