import type { ConfigRepository } from "@/repositories/config.repository.js";
import type { SecretsRepository } from "@/repositories/secrets.repository.js";
import { AigenError, type AigenCommandOutput } from "@/types/cli-output.types.js";
import type { AigenMediaKind, AigenModelCapabilities, AigenModelConfig } from "@/types/config.types.js";
import { parseModelRoute } from "@/utils/route.utils.js";
import type { ProviderRuntimeManager } from "@/managers/provider-runtime.manager.js";

export type ModelListOptions = {
  remote?: boolean;
  provider?: string;
  kind?: AigenMediaKind;
};

export type ModelWriteOptions = {
  kind?: AigenMediaKind;
  displayName?: string;
  maxCount?: number;
  generate?: boolean;
  edit?: boolean;
};

export class ModelsController {
  constructor(
    private readonly configRepository: ConfigRepository,
    private readonly secretsRepository: SecretsRepository,
    private readonly providerRuntimeManager: ProviderRuntimeManager,
  ) {}

  list = async (options: ModelListOptions): Promise<AigenCommandOutput> =>
    options.remote ? this.listRemote(options) : this.listLocal(options);

  private listLocal = async (options: ModelListOptions): Promise<AigenCommandOutput> => {
    const models = await this.configRepository.listModels(options.provider, options.kind);

    return {
      ok: true,
      models: models.map((model) => ({
        route: model.route,
        provider: model.providerId,
        providerLocalModel: model.providerLocalModel,
        kind: model.config.kind,
        displayName: model.config.displayName,
        capabilities: model.config.capabilities
      }))
    };
  };

  private listRemote = async (options: ModelListOptions): Promise<AigenCommandOutput> => {
    if (!options.provider) {
      throw new AigenError("INVALID_ARGUMENT", "Missing required --provider for remote model listing.");
    }

    const providerId = options.provider;
    const providerConfig = await this.configRepository.getProvider(providerId);
    const provider = this.providerRuntimeManager.getRemoteModelListProvider(providerConfig.apiFormat);
    const apiKey = await this.secretsRepository.getProviderApiKey(providerId);
    const result = await provider.listRemoteModels(
      {
        kind: options.kind
      },
      {
        providerId,
        apiFormat: providerConfig.apiFormat,
        apiBase: providerConfig.apiBase,
        apiKey,
        headers: providerConfig.headers
      },
    );

    return {
      ok: true,
      models: result.models.map((model) => ({
        route: `${providerId}/${model.providerLocalModel}`,
        provider: providerId,
        apiFormat: providerConfig.apiFormat,
        providerLocalModel: model.providerLocalModel,
        kind: "image",
        displayName: model.displayName,
        inputModalities: model.inputModalities,
        outputModalities: model.outputModalities,
        pricing: model.pricing,
        metadata: model.metadata
      })),
      metadata: result.metadata
    };
  };

  get = async (modelRoute: string): Promise<AigenCommandOutput> => {
    const route = parseModelRoute(modelRoute);
    const modelConfig = await this.configRepository.getModel(route.providerId, route.providerLocalModel);

    return {
      ok: true,
      model: {
        route: modelRoute,
        provider: route.providerId,
        providerLocalModel: route.providerLocalModel,
        kind: modelConfig.kind,
        displayName: modelConfig.displayName,
        capabilities: modelConfig.capabilities
      }
    };
  };

  add = async (modelRoute: string, options: ModelWriteOptions): Promise<AigenCommandOutput> => {
    const route = parseModelRoute(modelRoute);
    const modelConfig = this.fullModelConfigFromOptions(options);
    await this.configRepository.addModel(route.providerId, route.providerLocalModel, modelConfig);

    return {
      ok: true,
      model: {
        route: modelRoute,
        provider: route.providerId,
        providerLocalModel: route.providerLocalModel,
        ...modelConfig
      }
    };
  };

  update = async (modelRoute: string, options: ModelWriteOptions): Promise<AigenCommandOutput> => {
    const route = parseModelRoute(modelRoute);
    const modelConfig = await this.configRepository.updateModel(
      route.providerId,
      route.providerLocalModel,
      this.modelConfigFromOptions(options),
    );

    return {
      ok: true,
      model: {
        route: modelRoute,
        provider: route.providerId,
        providerLocalModel: route.providerLocalModel,
        ...modelConfig
      }
    };
  };

  remove = async (modelRoute: string): Promise<AigenCommandOutput> => {
    const route = parseModelRoute(modelRoute);
    await this.configRepository.removeModel(route.providerId, route.providerLocalModel);

    return {
      ok: true,
      removed: true,
      model: modelRoute
    };
  };

  private fullModelConfigFromOptions = (options: ModelWriteOptions): AigenModelConfig => {
    return {
      kind: options.kind ?? "image",
      displayName: options.displayName,
      capabilities: this.capabilitiesFromOptions(options)
    };
  };

  private modelConfigFromOptions = (options: ModelWriteOptions): Partial<AigenModelConfig> => {
    return {
      kind: options.kind,
      displayName: options.displayName,
      capabilities: this.capabilitiesFromOptions(options)
    };
  };

  private capabilitiesFromOptions = (options: ModelWriteOptions): AigenModelCapabilities | undefined => {
    const maxCount = options.maxCount;
    const generate = options.generate ?? false;
    const edit = options.edit ?? false;

    if (maxCount === undefined && !generate && !edit) {
      return undefined;
    }

    return {
      generate: generate || undefined,
      edit: edit || undefined,
      maxCount
    };
  };
}
