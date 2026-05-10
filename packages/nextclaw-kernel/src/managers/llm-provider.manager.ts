import {
  LLMProvider,
  LiteLLMProvider,
  ProviderRegistry,
  type Config,
  type LLMResponse,
  type LLMStreamEvent,
  type ProviderConfig,
  type ThinkingLevel,
} from "@nextclaw/core";
import { BUILTIN_PROVIDER_PLUGINS } from "@nextclaw/runtime";

type ProviderChatParams = {
  messages: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
  model?: string | null;
  maxTokens?: number;
  thinkingLevel?: ThinkingLevel | null;
  signal?: AbortSignal;
};

export type LlmProviderRuntime = {
  get: (model?: string | null) => LLMProvider;
  chat: (params: ProviderChatParams) => Promise<LLMResponse>;
  chatStream: (params: ProviderChatParams) => AsyncGenerator<LLMStreamEvent>;
};

type ProviderRoute = {
  model: string;
  providerName: string | null;
  provider: ProviderConfig | null;
  apiBase: string | null;
};

type ProviderConnectionTestInput = {
  providerName: string | null;
  apiKey?: string | null;
  apiBase?: string | null;
  defaultModel: string;
  extraHeaders?: Record<string, string> | null;
  wireApi?: "auto" | "chat" | "responses" | null;
  messages: Array<Record<string, unknown>>;
  maxTokens?: number;
  signal?: AbortSignal;
};

const normalizedModel = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const headersFingerprint = (headers: Record<string, string> | null | undefined): string => {
  if (!headers) {
    return "";
  }
  const sortedEntries = Object.entries(headers).sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify(sortedEntries);
};

class MissingKernelProvider extends LLMProvider {
  constructor(private defaultModel: string) {
    super(null, null);
  }

  readonly setDefaultModel = (model: string): void => {
    this.defaultModel = model;
  };

  readonly getDefaultModel = (): string => {
    return this.defaultModel;
  };

  readonly chat = async (_params: ProviderChatParams): Promise<never> => {
    throw new Error("No API key configured yet. Configure provider credentials in UI and retry.");
  };
}

export class LlmProviderManager {
  private readonly providerRegistry: ProviderRegistry;
  private readonly providerPool = new Map<string, LLMProvider>();
  private readonly missingProvider = new MissingKernelProvider("gpt-4o");
  private config: Config | null = null;

  constructor() {
    this.providerRegistry = new ProviderRegistry(BUILTIN_PROVIDER_PLUGINS);
  }

  readonly load = (config: Config): void => {
    this.config = config;
    this.providerPool.clear();
    this.missingProvider.setDefaultModel(config.agents.defaults.model);
  };

  readonly get = (model?: string | null): LLMProvider => {
    const route = this.resolveRoute(model);
    if (!route) {
      return this.missingProvider;
    }
    return this.getOrCreateProvider(route);
  };

  readonly chat = async (params: ProviderChatParams): Promise<LLMResponse> => {
    return this.get(params.model ?? null).chat(params);
  };

  readonly chatStream = async function* (
    this: LlmProviderManager,
    params: ProviderChatParams
  ): AsyncGenerator<LLMStreamEvent> {
    for await (const event of this.get(params.model ?? null).chatStream(params)) {
      yield event;
    }
  };

  readonly testConnection = async (input: ProviderConnectionTestInput): Promise<void> => {
    const provider = this.createProvider({
      providerName: input.providerName,
      provider: {
        enabled: true,
        displayName: "",
        apiKey: input.apiKey ?? "",
        apiBase: input.apiBase ?? null,
        extraHeaders: input.extraHeaders ?? null,
        wireApi: input.wireApi ?? "auto",
        models: [],
        modelThinking: {},
      },
      apiBase: input.apiBase ?? null,
      model: input.defaultModel,
    });
    await provider.chat({
      messages: input.messages,
      model: input.defaultModel,
      maxTokens: input.maxTokens,
      signal: input.signal,
    });
  };

  private readonly resolveRoute = (model?: string | null): ProviderRoute | null => {
    if (!this.config) {
      return null;
    }

    const effectiveModel = normalizedModel(model) ?? this.config.agents.defaults.model;
    const { provider, name } = this.resolveProvider(effectiveModel);
    const providerSpec = name ? this.providerRegistry.findProviderByName(name) : undefined;
    return {
      model: effectiveModel,
      providerName: name,
      provider,
      apiBase: provider?.apiBase ?? providerSpec?.defaultApiBase ?? null,
    };
  };

  private readonly resolveProvider = (model: string): {
    provider: ProviderConfig | null;
    name: string | null;
  } => {
    const providers = this.config?.providers as Record<string, ProviderConfig> | undefined;
    if (!providers) {
      return { provider: null, name: null };
    }

    const specs = this.providerRegistry.listProviderSpecs();
    const modelLower = model.toLowerCase();
    const modelPrefix = modelLower.includes("/")
      ? modelLower.slice(0, modelLower.indexOf("/"))
      : "";

    if (modelPrefix) {
      const prefixed = this.matchPrefixedProvider(providers, modelPrefix);
      if (prefixed) {
        return prefixed;
      }
    }

    const keywordMatches = specs
      .map((spec) => ({ name: spec.name, provider: providers[spec.name], spec }))
      .filter((entry) => entry.provider?.enabled !== false && Boolean(entry.provider?.apiKey))
      .filter((entry) => entry.spec.keywords.some((keyword) => modelLower.includes(keyword)));
    if (keywordMatches.length === 1) {
      const match = keywordMatches[0];
      return { provider: match.provider ?? null, name: match.name };
    }
    if (keywordMatches.length > 1) {
      return { provider: null, name: null };
    }

    const builtinNames = new Set(specs.map((spec) => spec.name));
    const enabledProviders = Object.entries(providers)
      .filter(([, provider]) => provider.enabled !== false && Boolean(provider.apiKey));
    const enabledBuiltin = enabledProviders.filter(([name]) => builtinNames.has(name));
    if (enabledBuiltin.length === 1) {
      const [name, provider] = enabledBuiltin[0];
      return { provider, name };
    }
    const enabledCustom = enabledProviders.filter(([name]) => !builtinNames.has(name));
    if (enabledCustom.length === 1) {
      const [name, provider] = enabledCustom[0];
      return { provider, name };
    }
    return { provider: null, name: null };
  };

  private readonly matchPrefixedProvider = (
    providers: Record<string, ProviderConfig>,
    modelPrefix: string
  ): { provider: ProviderConfig | null; name: string | null } | null => {
    for (const spec of this.providerRegistry.listProviderSpecs()) {
      const provider = providers[spec.name];
      const aliases = [spec.name, spec.modelPrefix ?? ""]
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      if (provider && aliases.includes(modelPrefix)) {
        return provider.enabled !== false
          ? { provider, name: spec.name }
          : { provider: null, name: null };
      }
    }
    const customProvider = Object.entries(providers)
      .find(([name]) => name.toLowerCase() === modelPrefix);
    if (!customProvider) {
      return null;
    }
    const [name, provider] = customProvider;
    return provider.enabled !== false ? { provider, name } : { provider: null, name: null };
  };

  private readonly getOrCreateProvider = (route: ProviderRoute): LLMProvider => {
    if (!route.provider?.apiKey && !route.model.startsWith("bedrock/")) {
      return this.missingProvider;
    }

    const cacheKey = this.buildCacheKey(route);
    const cached = this.providerPool.get(cacheKey);
    if (cached) {
      return cached;
    }

    const created = this.createProvider(route);
    this.providerPool.set(cacheKey, created);
    return created;
  };

  private readonly createProvider = (route: ProviderRoute): LLMProvider => {
    return new LiteLLMProvider({
      apiKey: route.provider?.apiKey ?? null,
      apiBase: route.apiBase,
      defaultModel: route.model,
      extraHeaders: route.provider?.extraHeaders ?? null,
      providerName: route.providerName,
      providerRegistry: this.providerRegistry,
      wireApi: route.provider?.wireApi ?? null,
    });
  };

  private readonly buildCacheKey = (route: ProviderRoute): string => {
    const routeProvider = route.provider;
    return [
      route.providerName ?? "",
      routeProvider?.apiKey ?? "",
      route.apiBase ?? "",
      routeProvider?.wireApi ?? "",
      headersFingerprint(routeProvider?.extraHeaders ?? null),
    ].join("||");
  };
}
