import { LLMProvider, type LLMResponse, type LLMStreamEvent } from "./base.js";
import { AnthropicMessagesProvider } from "./anthropic/anthropic-messages.provider.js";
import { OpenAICompatibleProvider } from "./openai_provider.js";
import { findGateway, findProviderByModel, findProviderByName, type ProviderSpec } from "./registry.js";
import type { ThinkingLevel } from "../utils/thinking.js";

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
  private providerName?: string | null;
  private gatewaySpec?: ProviderSpec;
  private client: LLMProvider;

  constructor(options: LiteLLMProviderOptions) {
    const {
      apiBase,
      apiKey,
      defaultModel,
      extraHeaders: optionExtraHeaders,
      providerName,
      wireApi: requestedWireApi
    } = options;
    super(apiKey, apiBase);
    this.defaultModel = defaultModel;
    this.providerName = providerName ?? null;
    this.gatewaySpec = findGateway(this.providerName, apiKey ?? null, apiBase ?? null) ?? undefined;
    const providerSpec = this.providerName ? findProviderByName(this.providerName) : undefined;
    const supportsWireApi = providerSpec?.supportsWireApi === true || !providerSpec;
    const wireApi = supportsWireApi
      ? requestedWireApi ?? providerSpec?.defaultWireApi ?? "auto"
      : undefined;
    const extraHeaders = this.mergeExtraHeaders(providerSpec, optionExtraHeaders ?? null);
    this.client = providerSpec?.apiProtocol === "anthropic-messages"
      ? new AnthropicMessagesProvider({
          apiKey: apiKey ?? null,
          apiBase: apiBase ?? null,
          defaultModel,
          extraHeaders
        })
      : new OpenAICompatibleProvider({
          apiKey: apiKey ?? null,
          apiBase: apiBase ?? null,
          defaultModel,
          extraHeaders,
          wireApi,
          enableResponsesFallback: providerSpec?.supportsResponsesApi !== false
        });
  }

  getDefaultModel = (): string => {
    return this.defaultModel;
  };

  chat = async (params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    thinkingLevel?: ThinkingLevel | null;
    signal?: AbortSignal;
  }): Promise<LLMResponse> => {
    const { maxTokens, messages, model, signal, thinkingLevel, tools } = params;
    const requestedModel = this.stripCustomProviderPrefix(model ?? this.defaultModel);
    const resolvedModel = this.resolveModel(requestedModel);
    const apiModel = this.stripRoutingPrefix(resolvedModel);
    const overrides = this.applyModelOverrides(apiModel, { maxTokens });

    return this.client.chat({
      messages,
      tools,
      model: apiModel,
      maxTokens: overrides.maxTokens,
      thinkingLevel,
      signal
    });
  };

  chatStream = (params: {
    messages: Array<Record<string, unknown>>;
    tools?: Array<Record<string, unknown>>;
    model?: string | null;
    maxTokens?: number;
    thinkingLevel?: ThinkingLevel | null;
    signal?: AbortSignal;
  }): AsyncGenerator<LLMStreamEvent> => {
    return (async function* (provider: LiteLLMProvider): AsyncGenerator<LLMStreamEvent> {
      const requestedModel = provider.stripCustomProviderPrefix(params.model ?? provider.defaultModel);
      const resolvedModel = provider.resolveModel(requestedModel);
      const apiModel = provider.stripRoutingPrefix(resolvedModel);
      const overrides = provider.applyModelOverrides(apiModel, { maxTokens: params.maxTokens });

      for await (const event of provider.client.chatStream({
        messages: params.messages,
        tools: params.tools,
        model: apiModel,
        maxTokens: overrides.maxTokens,
        thinkingLevel: params.thinkingLevel,
        signal: params.signal
      })) {
        yield event;
      }
    })(this);
  };

  private resolveModel = (model: string): string => {
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
  };

  private stripRoutingPrefix = (model: string): string => {
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
  };

  private applyModelOverrides = (model: string, params: { maxTokens?: number }) => {
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
  };

  private getStandardSpec = (model: string): ProviderSpec | undefined => {
    if (this.providerName) {
      const explicit = findProviderByName(this.providerName);
      if (explicit) {
        return explicit;
      }
      return undefined;
    }
    return findProviderByModel(model);
  };

  private mergeExtraHeaders = (
    providerSpec: ProviderSpec | undefined,
    extraHeaders: Record<string, string> | null
  ): Record<string, string> | null => {
    const defaultHeaders = providerSpec?.defaultHeaders;
    if (!defaultHeaders || Object.keys(defaultHeaders).length === 0) {
      return extraHeaders;
    }
    return {
      ...defaultHeaders,
      ...(extraHeaders ?? {})
    };
  };

  private stripCustomProviderPrefix = (model: string): string => {
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
  };
}
