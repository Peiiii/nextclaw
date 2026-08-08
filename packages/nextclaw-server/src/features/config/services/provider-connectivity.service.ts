import {
  getProviderName,
  type Config,
  type ProviderConfig,
  type ProviderSpec,
} from "@nextclaw/core";
import type { LlmProviderManager } from "@nextclaw/kernel";
import { findServerBuiltinProviderByName } from "@nextclaw-server/features/config/providers/server-builtin-provider.provider.js";
import { loadConfigOrDefault } from "@nextclaw-server/features/config/stores/server-config.store.js";
import type {
  ProviderConfigUpdate,
  ProviderConnectionTestRequest,
  ProviderConnectionTestResult,
  ProviderModelDiscoveryRequest,
  ProviderModelDiscoveryResult,
} from "@nextclaw-server/shared/types/server-api.types.js";

const PROVIDER_TEST_MAX_TOKENS = 16;

type ResolvedProviderRuntimeDraft = {
  providerType: string | null;
  spec?: ProviderSpec;
  apiKey: string | null;
  apiBase: string | null;
  extraHeaders: Record<string, string> | null;
  wireApi: "auto" | "chat" | "responses" | null;
};

export class ProviderConnectivityService {
  constructor(
    private readonly configPath: string,
    private readonly providerManager?: LlmProviderManager,
  ) {}

  private readonly normalizeOptionalString = (value: unknown): string | null => {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  private readonly normalizeHeaders = (
    input: Record<string, string> | null | undefined,
  ): Record<string, string> | null => {
    if (!input) {
      return null;
    }
    const entries = Object.entries(input)
      .map(([key, value]) => [key.trim(), String(value ?? "").trim()] as const)
      .filter(([key, value]) => key.length > 0 && value.length > 0);
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  };

  private readonly normalizeModelList = (input: string[] | null | undefined): string[] => {
    const models = new Set<string>();
    for (const value of input ?? []) {
      const model = typeof value === "string" ? value.trim() : "";
      if (model) {
        models.add(model);
      }
    }
    return [...models];
  };

  private readonly resolveProviderType = (
    providerId: string,
    provider?: ProviderConfig | null,
  ): string | null => {
    const configuredType = this.normalizeOptionalString(provider?.providerType);
    if (configuredType && findServerBuiltinProviderByName(configuredType)) {
      return configuredType;
    }
    return findServerBuiltinProviderByName(providerId) ? providerId : null;
  };

  private readonly resolveRuntimeDraft = (
    providerId: string,
    provider: ProviderConfig,
    patch: ProviderConfigUpdate,
  ): ResolvedProviderRuntimeDraft => {
    const providerType = this.resolveProviderType(providerId, provider);
    const spec = findServerBuiltinProviderByName(providerType ?? "");
    const apiKey = Object.prototype.hasOwnProperty.call(patch, "apiKey")
      ? this.normalizeOptionalString(patch.apiKey) ?? this.normalizeOptionalString(spec?.anonymousApiKey)
      : this.normalizeOptionalString(provider.apiKey) ?? this.normalizeOptionalString(spec?.anonymousApiKey);
    const apiBase = Object.prototype.hasOwnProperty.call(patch, "apiBase")
      ? this.normalizeOptionalString(patch.apiBase) ?? spec?.defaultApiBase ?? null
      : this.normalizeOptionalString(provider.apiBase) ?? spec?.defaultApiBase ?? null;
    const extraHeaders = Object.prototype.hasOwnProperty.call(patch, "extraHeaders")
      ? this.normalizeHeaders(patch.extraHeaders ?? null)
      : this.normalizeHeaders(provider.extraHeaders ?? null);
    const wireApi = spec?.supportsWireApi || !spec
      ? patch.wireApi ?? provider.wireApi ?? spec?.defaultWireApi ?? "auto"
      : null;
    return { providerType, spec, apiKey, apiBase, extraHeaders, wireApi };
  };

  private readonly buildScopedModel = (providerName: string, model: string, spec?: ProviderSpec): string => {
    const trimmed = model.trim();
    if (!trimmed || trimmed.includes("/") || !findServerBuiltinProviderByName(providerName)) {
      return trimmed;
    }
    const prefix = (spec?.modelPrefix ?? providerName).trim();
    return prefix ? `${prefix}/${trimmed}` : trimmed;
  };

  private readonly rewriteProviderRoutePrefix = (
    providerId: string,
    targetPrefix: string | null,
    model: string,
  ): string => {
    const prefix = `${providerId}/`;
    if (!model.startsWith(prefix)) {
      return model;
    }
    const stripped = model.slice(prefix.length).trim();
    return stripped ? (targetPrefix ? `${targetPrefix}/${stripped}` : stripped) : model;
  };

  private readonly resolveTestModel = (
    config: Config,
    providerId: string,
    requestedModel: string | null,
    provider: ProviderConfig,
    spec?: ProviderSpec,
  ): string | null => {
    if (requestedModel) {
      return this.rewriteProviderRoutePrefix(providerId, spec?.name ?? null, requestedModel);
    }
    const providerModels = this.normalizeModelList(provider.models)
      .map((modelId) => {
        const providerModel = this.rewriteProviderRoutePrefix(providerId, null, modelId);
        return spec ? this.buildScopedModel(spec.name, providerModel, spec) : providerModel;
      })
      .filter(Boolean);
    if (providerModels.length > 0) {
      return providerModels[0] ?? null;
    }
    const defaultModel = this.normalizeOptionalString(config.agents.defaults.model);
    if (defaultModel) {
      const routedProvider = getProviderName(config, defaultModel);
      if (!routedProvider || routedProvider === providerId) {
        return this.rewriteProviderRoutePrefix(providerId, spec?.name ?? null, defaultModel);
      }
    }
    return spec ? this.normalizeModelList(spec.defaultModels)[0] ?? defaultModel : null;
  };

  private readonly readProvider = (providerId: string): { config: Config; provider: ProviderConfig } | null => {
    const config = loadConfigOrDefault(this.configPath);
    const provider = (config.providers as Record<string, ProviderConfig>)[providerId];
    return provider ? { config, provider } : null;
  };

  testConnection = async (
    providerId: string,
    patch: ProviderConnectionTestRequest,
  ): Promise<ProviderConnectionTestResult | null> => {
    const resolved = this.readProvider(providerId);
    if (!resolved) {
      return null;
    }
    const { config, provider } = resolved;
    const { providerType, spec, apiKey, apiBase, extraHeaders, wireApi } = this.resolveRuntimeDraft(
      providerId,
      provider,
      patch,
    );
    if (!apiKey && !spec?.isLocal) {
      return {
        success: false,
        provider: providerId,
        latencyMs: 0,
        message: "API key is required before testing the connection.",
      };
    }
    const model = this.resolveTestModel(
      config,
      providerId,
      this.normalizeOptionalString(patch.model),
      provider,
      spec,
    );
    if (!model) {
      return {
        success: false,
        provider: providerId,
        latencyMs: 0,
        message: "No test model found. Configure provider models or set a default model for this provider, then try again.",
      };
    }
    const startedAtMs = Date.now();
    if (!this.providerManager) {
      return {
        success: false,
        provider: providerId,
        model,
        latencyMs: Date.now() - startedAtMs,
        message: "Provider manager is unavailable.",
      };
    }
    try {
      await this.providerManager.testConnection({
        providerName: providerType,
        apiKey,
        apiBase,
        defaultModel: model,
        extraHeaders,
        wireApi,
        messages: [{ role: "user", content: "ping" }],
        maxTokens: PROVIDER_TEST_MAX_TOKENS,
      });
      return {
        success: true,
        provider: providerId,
        model,
        latencyMs: Date.now() - startedAtMs,
        message: "Connection test passed.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        provider: providerId,
        model,
        latencyMs: Date.now() - startedAtMs,
        message: message.replace(/\s+/g, " ").trim() || "Connection test failed.",
      };
    }
  };

  discoverModels = async (
    providerId: string,
    patch: ProviderModelDiscoveryRequest,
  ): Promise<ProviderModelDiscoveryResult | null> => {
    const resolved = this.readProvider(providerId);
    if (!resolved) {
      return null;
    }
    if (!this.providerManager) {
      throw new Error("Provider manager is unavailable.");
    }
    const { providerType, apiKey, apiBase, extraHeaders } = this.resolveRuntimeDraft(
      providerId,
      resolved.provider,
      patch,
    );
    const result = await this.providerManager.discoverModels({
      providerName: providerType,
      apiKey,
      apiBase,
      extraHeaders,
    });
    return {
      provider: providerId,
      models: result.models,
      source: result.source,
      fetchedAt: new Date().toISOString(),
    };
  };
}
