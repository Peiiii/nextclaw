import { LLMProvider, type LLMResponse, type LLMStreamEvent } from "./base.js";
import { OpenAICompatibleProvider } from "./openai_provider.js";
import { findGateway, findProviderByModel, findProviderByName, type ProviderSpec } from "./registry.js";

export type LiteLLMProviderOptions = {
  apiKey?: string | null;
  apiBase?: string | null;
  defaultModel: string;
  extraHeaders?: Record<string, string> | null;
  providerName?: string | null;
  wireApi?: "auto" | "chat" | "responses" | null;
};

export class LiteLLMProvider extends LLMProvider {
  private defaultModel: string;
  private extraHeaders?: Record<string, string> | null;
  private providerName?: string | null;
  private gatewaySpec?: ProviderSpec;
  private client: OpenAICompatibleProvider;

  constructor(options: LiteLLMProviderOptions) {
    super(options.apiKey, options.apiBase);
    this.defaultModel = options.defaultModel;
    this.extraHeaders = options.extraHeaders ?? null;
    this.providerName = options.providerName ?? null;
    this.gatewaySpec = findGateway(this.providerName, options.apiKey ?? null, options.apiBase ?? null) ?? undefined;
    const providerSpec = this.providerName ? findProviderByName(this.providerName) : undefined;
    const wireApi = providerSpec?.supportsWireApi
      ? options.wireApi ?? providerSpec.defaultWireApi ?? "auto"
      : undefined;
    this.client = new OpenAICompatibleProvider({
      apiKey: options.apiKey ?? null,
      apiBase: options.apiBase ?? null,
      defaultModel: options.defaultModel,
      extraHeaders: options.extraHeaders ?? null,
      wireApi
    });
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  async chat(params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<LLMResponse> {
    const requestedModel = this.stripCustomProviderPrefix(params.model ?? this.defaultModel);
    const resolvedModel = this.resolveModel(requestedModel);
    const apiModel = this.stripRoutingPrefix(resolvedModel);
    const overrides = this.applyModelOverrides(apiModel, { maxTokens: params.maxTokens });

    return this.client.chat({
      messages: params.messages,
      tools: params.tools,
      model: apiModel,
      maxTokens: overrides.maxTokens,
      signal: params.signal
    });
  }

  async *chatStream(params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    signal?: AbortSignal;
  }): AsyncGenerator<LLMStreamEvent> {
    const requestedModel = this.stripCustomProviderPrefix(params.model ?? this.defaultModel);
    const resolvedModel = this.resolveModel(requestedModel);
    const apiModel = this.stripRoutingPrefix(resolvedModel);
    const overrides = this.applyModelOverrides(apiModel, { maxTokens: params.maxTokens });

    for await (const event of this.client.chatStream({
      messages: params.messages,
      tools: params.tools,
      model: apiModel,
      maxTokens: overrides.maxTokens,
      signal: params.signal
    })) {
      yield event;
    }
  }

  private resolveModel(model: string): string {
    if (this.gatewaySpec) {
      let resolved = model;
      if (this.gatewaySpec.stripModelPrefix && resolved.includes("/")) {
        resolved = resolved.split("/").slice(-1)[0];
      }
      const prefix = this.gatewaySpec.litellmPrefix ?? "";
      if (prefix && !resolved.startsWith(`${prefix}/`)) {
        resolved = `${prefix}/${resolved}`;
      }
      return resolved;
    }

    const spec = this.getStandardSpec(model);
    if (!spec) {
      return model;
    }

    if (spec.litellmPrefix) {
      const skipPrefixes = spec.skipPrefixes ?? [];
      if (!skipPrefixes.some((prefix) => model.startsWith(prefix))) {
        return `${spec.litellmPrefix}/${model}`;
      }
    }

    return model;
  }

  private stripRoutingPrefix(model: string): string {
    if (this.gatewaySpec) {
      const prefix = this.gatewaySpec.litellmPrefix ?? "";
      if (prefix && model.startsWith(`${prefix}/`)) {
        return model.slice(prefix.length + 1);
      }
      return model;
    }
    const spec = this.getStandardSpec(model);
    if (!spec?.litellmPrefix) {
      return model;
    }
    const prefix = `${spec.litellmPrefix}/`;
    if (model.startsWith(prefix)) {
      return model.slice(prefix.length);
    }
    return model;
  }

  private applyModelOverrides(model: string, params: { maxTokens?: number }) {
    const spec = this.getStandardSpec(model);
    if (!spec?.modelOverrides?.length) {
      return params;
    }
    const match = spec.modelOverrides.find(([pattern]) => model.toLowerCase().includes(pattern));
    if (!match) {
      return params;
    }
    const overrides = match[1];
    return {
      maxTokens: typeof overrides.max_tokens === "number" ? overrides.max_tokens : params.maxTokens
    };
  }

  private getStandardSpec(model: string): ProviderSpec | undefined {
    if (this.providerName) {
      const explicit = findProviderByName(this.providerName);
      if (explicit) {
        return explicit;
      }
      return undefined;
    }
    return findProviderByModel(model);
  }

  private stripCustomProviderPrefix(model: string): string {
    const provider = this.providerName?.trim();
    if (!provider) {
      return model;
    }
    if (findProviderByName(provider)) {
      return model;
    }
    const prefix = `${provider}/`;
    if (!model.startsWith(prefix)) {
      return model;
    }
    const stripped = model.slice(prefix.length).trim();
    return stripped.length > 0 ? stripped : model;
  }
}
