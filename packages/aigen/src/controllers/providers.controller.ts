import type { ConfigRepository } from "@/repositories/config.repository.js";
import type { AigenCommandOutput } from "@/types/cli-output.types.js";
import type { AigenProviderConfig } from "@/types/config.types.js";

export type ProviderAddOptions = {
  apiFormat: string;
  displayName?: string;
  apiBase?: string;
};

export type ProviderUpdateOptions = Partial<ProviderAddOptions>;

export class ProvidersController {
  constructor(private readonly configRepository: ConfigRepository) {}

  list = async (): Promise<AigenCommandOutput> => {
    const providers = await this.configRepository.listProviders();
    return {
      ok: true,
      providers: providers.map(({ id, config }) => this.toProviderOutput(id, config))
    };
  };

  get = async (providerId: string): Promise<AigenCommandOutput> => ({
    ok: true,
    provider: this.toProviderOutput(providerId, await this.configRepository.getProvider(providerId))
  });

  add = async (providerId: string, options: ProviderAddOptions): Promise<AigenCommandOutput> => {
    const { apiFormat, displayName, apiBase } = options;
    const providerConfig: AigenProviderConfig = {
      apiFormat,
      displayName,
      apiKeyRef: `provider:${providerId}`,
      apiBase: apiBase ?? this.defaultApiBase(apiFormat),
      models: {}
    };

    await this.configRepository.addProvider(providerId, providerConfig);
    return {
      ok: true,
      provider: this.toProviderOutput(providerId, providerConfig)
    };
  };

  update = async (providerId: string, options: ProviderUpdateOptions): Promise<AigenCommandOutput> => {
    const { apiFormat, displayName, apiBase } = options;
    const providerConfig = await this.configRepository.updateProvider(providerId, {
      apiFormat,
      displayName,
      apiBase
    });

    return {
      ok: true,
      provider: this.toProviderOutput(providerId, providerConfig)
    };
  };

  remove = async (providerId: string): Promise<AigenCommandOutput> => {
    await this.configRepository.removeProvider(providerId);
    return {
      ok: true,
      removed: true,
      providerId
    };
  };

  private toProviderOutput = (providerId: string, config: AigenProviderConfig): Record<string, unknown> => ({
    id: providerId,
    apiFormat: config.apiFormat,
    displayName: config.displayName,
    apiBase: config.apiBase,
    apiKeyRef: config.apiKeyRef,
    modelCount: Object.keys(config.models).length
  });

  private defaultApiBase = (apiFormat: string): string => {
    if (apiFormat === "openrouter") {
      return "https://openrouter.ai/api/v1";
    }

    if (apiFormat === "openai") {
      return "https://api.openai.com/v1";
    }

    return "";
  };
}
