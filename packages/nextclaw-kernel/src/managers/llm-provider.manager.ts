import {
  LLMProvider,
  LiteLLMProvider,
  ProviderRegistry,
  modelSupportsVision,
  normalizeProviderModelConfig,
  type Config,
  type LLMResponse,
  type LLMStreamEvent,
  type ProviderConfig,
  type ThinkingLevel,
} from "@nextclaw/core";
import { BUILTIN_PROVIDER_PLUGINS } from "@nextclaw/runtime";
import { normalizeModelMessagesForVisionSupport } from "@kernel/utils/model-message-vision.utils.js";

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
  providerId: string | null;
  providerName: string | null;
  provider: ProviderConfig | null;
  apiBase: string | null;
  modelConfig?: ProviderConfig["modelConfig"];
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

  setDefaultModel = (model: string): void => {
    this.defaultModel = model;
  };

  getDefaultModel = (): string => {
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

  load = (config: Config): void => {
    this.config = config;
    this.providerPool.clear();
    this.missingProvider.setDefaultModel(config.agents.defaults.model);
  };

  get = (model?: string | null): LLMProvider => {
    const route = this.resolveRoute(model);
    if (!route) {
      return this.missingProvider;
    }
    return this.getOrCreateProvider(route);
  };

  readonly chat = async (params: ProviderChatParams): Promise<LLMResponse> => {
    const route = this.resolveRoute(params.model ?? null);
    const provider = route ? this.getOrCreateProvider(route) : this.missingProvider;
    return provider.chat({
      ...params,
      messages: this.prepareMessagesForProvider(route, params.messages),
    });
  };

  readonly chatStream = async function* (
    this: LlmProviderManager,
    params: ProviderChatParams
  ): AsyncGenerator<LLMStreamEvent> {
    const route = this.resolveRoute(params.model ?? null);
    const provider = route ? this.getOrCreateProvider(route) : this.missingProvider;
    for await (const event of provider.chatStream({
      ...params,
      messages: this.prepareMessagesForProvider(route, params.messages),
    })) {
      yield event;
    }
  };

  readonly testConnection = async (input: ProviderConnectionTestInput): Promise<void> => {
    const provider = this.createProvider({
      providerName: input.providerName,
      providerId: input.providerName,
      provider: {
        enabled: true,
        providerType: input.providerName,
        displayName: "",
        apiKey: input.apiKey ?? "",
        apiBase: input.apiBase ?? null,
        extraHeaders: input.extraHeaders ?? null,
        wireApi: input.wireApi ?? "auto",
        models: [],
        modelConfig: {},
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

  private resolveRoute = (model?: string | null): ProviderRoute | null => {
    if (!this.config) {
      return null;
    }

    const effectiveModel = normalizedModel(model) ?? this.config.agents.defaults.model;
    const route = this.resolveProvider(effectiveModel);
    const { provider, name } = route;
    const providerSpec = name ? this.providerRegistry.findProviderByName(name) : undefined;
    const specModelConfig = normalizeProviderModelConfig(providerSpec?.modelConfig ?? {});
    const providerModelConfig = this.normalizeProviderModelConfigForRoute(
      provider?.modelConfig ?? {},
      route.providerId,
      name
    );
    return {
      model: route.model,
      providerId: route.providerId,
      providerName: name,
      provider,
      apiBase: provider?.apiBase ?? providerSpec?.defaultApiBase ?? null,
      modelConfig: { ...specModelConfig, ...providerModelConfig },
    };
  };

  private resolveProvider = (model: string): {
    provider: ProviderConfig | null;
    name: string | null;
    providerId: string | null;
    model: string;
  } => {
    const providers = this.config?.providers as Record<string, ProviderConfig> | undefined;
    if (!providers) {
      return { provider: null, name: null, providerId: null, model };
    }

    const specs = this.providerRegistry.listProviderSpecs();
    const modelLower = model.toLowerCase();
    const modelPrefix = modelLower.includes("/")
      ? modelLower.slice(0, modelLower.indexOf("/"))
      : "";

    if (modelPrefix) {
      const prefixed = this.matchPrefixedProvider(providers, modelPrefix, model);
      if (prefixed) {
        return prefixed;
      }
    }

    const keywordMatches = Object.entries(providers)
      .map(([providerId, provider]) => {
        const providerType = this.resolveProviderType(providerId, provider);
        const spec = providerType ? this.providerRegistry.findProviderByName(providerType) : undefined;
        return { name: providerType, providerId, provider, spec };
      })
      .filter((entry): entry is { name: string; providerId: string; provider: ProviderConfig; spec: NonNullable<ReturnType<ProviderRegistry["findProviderByName"]>> } => Boolean(entry.name && entry.spec))
      .filter((entry) => entry.provider?.enabled !== false && Boolean(entry.provider?.apiKey))
      .filter((entry) => entry.spec.keywords.some((keyword) => modelLower.includes(keyword)));
    if (keywordMatches.length === 1) {
      const match = keywordMatches[0];
      const providerId = match.providerId;
      return { provider: match.provider ?? null, name: match.name, providerId, model: this.rewriteModelForTemplate(model, providerId, match.name) };
    }
    if (keywordMatches.length > 1) {
      return { provider: null, name: null, providerId: null, model };
    }

    const builtinNames = new Set(specs.map((spec) => spec.name));
    const enabledProviders = Object.entries(providers)
      .filter(([, provider]) => provider.enabled !== false && Boolean(provider.apiKey));
    const enabledBuiltin = enabledProviders.filter(([name]) => builtinNames.has(name));
    if (enabledBuiltin.length === 1) {
      const [name, provider] = enabledBuiltin[0];
      const providerType = this.resolveProviderType(name, provider);
      return { provider, name: providerType, providerId: name, model: this.rewriteModelForTemplate(model, name, providerType) };
    }
    const enabledCustom = enabledProviders.filter(([name]) => !builtinNames.has(name));
    if (enabledCustom.length === 1) {
      const [name, provider] = enabledCustom[0];
      const providerType = this.resolveProviderType(name, provider);
      return { provider, name: providerType, providerId: name, model: this.rewriteModelForTemplate(model, name, providerType) };
    }
    return { provider: null, name: null, providerId: null, model };
  };

  private matchPrefixedProvider = (
    providers: Record<string, ProviderConfig>,
    modelPrefix: string,
    model: string
  ): { provider: ProviderConfig | null; name: string | null; providerId: string | null; model: string } | null => {
    const customProvider = Object.entries(providers)
      .find(([name]) => name.toLowerCase() === modelPrefix);
    if (!customProvider) {
      return null;
    }
    const [providerId, provider] = customProvider;
    if (provider.enabled === false) {
      return { provider: null, name: null, providerId, model };
    }
    const providerType = this.resolveProviderType(providerId, provider);
    return {
      provider,
      name: providerType,
      providerId,
      model: this.rewriteModelForTemplate(model, providerId, providerType),
    };
  };

  private resolveProviderType = (providerId: string, provider: ProviderConfig): string | null => {
    const configuredType = typeof provider.providerType === "string" ? provider.providerType.trim() : "";
    if (configuredType && this.providerRegistry.findProviderByName(configuredType)) {
      return configuredType;
    }
    return this.providerRegistry.findProviderByName(providerId) ? providerId : null;
  };

  private rewriteModelForTemplate = (model: string, providerId: string, providerType: string | null): string => {
    const prefix = `${providerId}/`;
    if (!model.startsWith(prefix)) {
      return model;
    }
    const suffix = model.slice(prefix.length).trim();
    if (!suffix) {
      return model;
    }
    return providerType ? `${providerType}/${suffix}` : suffix;
  };

  private normalizeProviderModelConfigForRoute = (
    modelConfig: ProviderConfig["modelConfig"],
    providerId: string | null,
    providerType: string | null,
  ): ProviderConfig["modelConfig"] => {
    const normalized = normalizeProviderModelConfig(modelConfig ?? {});
    if (!providerId || !providerType) {
      return normalized;
    }
    const rewritten: ProviderConfig["modelConfig"] = {};
    for (const [model, config] of Object.entries(normalized)) {
      rewritten[this.rewriteModelForTemplate(model, providerId, providerType)] = config;
    }
    return rewritten;
  };

  private getOrCreateProvider = (route: ProviderRoute): LLMProvider => {
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

  private createProvider = (route: ProviderRoute): LLMProvider => {
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

  private prepareMessagesForProvider = (
    route: ProviderRoute | null,
    messages: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> => {
    return normalizeModelMessagesForVisionSupport({
      messages,
      supportsVision: modelSupportsVision({
        model: route?.model,
        providerName: route?.providerName,
        modelConfig: route?.modelConfig,
      }),
    });
  };

  private buildCacheKey = (route: ProviderRoute): string => {
    const routeProvider = route.provider;
    return [
      route.providerName ?? "",
      route.providerId ?? "",
      routeProvider?.apiKey ?? "",
      route.apiBase ?? "",
      routeProvider?.wireApi ?? "",
      headersFingerprint(routeProvider?.extraHeaders ?? null),
    ].join("||");
  };
}
