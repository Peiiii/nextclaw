import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { AigenError } from "@/types/cli-output.types.js";
import {
  createEmptyAigenConfig,
  type AigenConfig,
  type AigenModelConfig,
  type AigenProviderConfig
} from "@/types/config.types.js";
import { assertResourceId } from "@/utils/route.utils.js";

export class ConfigRepository {
  readonly homeDir: string;
  readonly configPath: string;

  constructor(homeDir = process.env.AIGEN_HOME ?? join(homedir(), ".aigen")) {
    this.homeDir = homeDir;
    this.configPath = join(homeDir, "config.json");
  }

  readConfig = async (): Promise<AigenConfig> => {
    try {
      const text = await readFile(this.configPath, "utf8");
      return this.parseConfig(text);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        throw new AigenError("CONFIG_NOT_FOUND", "aigen config.json does not exist.");
      }

      throw error;
    }
  };

  readConfigOrCreate = async (): Promise<AigenConfig> => {
    try {
      return await this.readConfig();
    } catch (error) {
      if (error instanceof AigenError && error.code === "CONFIG_NOT_FOUND") {
        return createEmptyAigenConfig();
      }

      throw error;
    }
  };

  writeConfig = async (config: AigenConfig): Promise<void> => {
    await mkdir(this.homeDir, { recursive: true });
    await writeFile(this.configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  };

  listProviders = async (): Promise<Array<{ id: string; config: AigenProviderConfig }>> => {
    const config = await this.readConfig();
    return Object.entries(config.providers).map(([id, providerConfig]) => ({
      id,
      config: providerConfig
    }));
  };

  getProvider = async (providerId: string): Promise<AigenProviderConfig> => {
    const config = await this.readConfig();
    const providerConfig = config.providers[providerId];

    if (!providerConfig) {
      throw new AigenError("PROVIDER_NOT_FOUND", `Provider '${providerId}' does not exist.`);
    }

    return providerConfig;
  };

  addProvider = async (providerId: string, providerConfig: AigenProviderConfig): Promise<void> => {
    assertResourceId(providerId, "Provider id");
    const config = await this.readConfigOrCreate();

    if (config.providers[providerId]) {
      throw new AigenError("INVALID_ARGUMENT", `Provider '${providerId}' already exists.`);
    }

    config.providers[providerId] = providerConfig;
    await this.writeConfig(config);
  };

  updateProvider = async (
    providerId: string,
    patch: Partial<Omit<AigenProviderConfig, "models">>,
  ): Promise<AigenProviderConfig> => {
    const config = await this.readConfig();
    const current = config.providers[providerId];

    if (!current) {
      throw new AigenError("PROVIDER_NOT_FOUND", `Provider '${providerId}' does not exist.`);
    }

    const next: AigenProviderConfig = {
      ...current,
      apiFormat: patch.apiFormat ?? current.apiFormat,
      displayName: patch.displayName ?? current.displayName,
      apiBase: patch.apiBase ?? current.apiBase,
      apiKeyRef: patch.apiKeyRef ?? current.apiKeyRef,
      headers: patch.headers ?? current.headers
    };

    config.providers[providerId] = next;
    await this.writeConfig(config);
    return next;
  };

  removeProvider = async (providerId: string): Promise<void> => {
    const config = await this.readConfig();

    if (!config.providers[providerId]) {
      throw new AigenError("PROVIDER_NOT_FOUND", `Provider '${providerId}' does not exist.`);
    }

    delete config.providers[providerId];
    await this.writeConfig(config);
  };

  listModels = async (
    providerId?: string,
    kind?: string,
  ): Promise<
    Array<{ route: string; providerId: string; providerLocalModel: string; config: AigenModelConfig }>
  > => {
    const config = await this.readConfig();
    const providers = providerId
      ? [[providerId, await this.getProvider(providerId)] as const]
      : Object.entries(config.providers);

    return providers.flatMap(([id, providerConfig]) =>
      Object.entries(providerConfig.models)
        .filter(([, modelConfig]) => !kind || modelConfig.kind === kind)
        .map(([providerLocalModel, modelConfig]) => ({
          route: `${id}/${providerLocalModel}`,
          providerId: id,
          providerLocalModel,
          config: modelConfig
        })),
    );
  };

  getModel = async (providerId: string, providerLocalModel: string): Promise<AigenModelConfig> => {
    const providerConfig = await this.getProvider(providerId);
    const modelConfig = providerConfig.models[providerLocalModel];

    if (!modelConfig) {
      throw new AigenError("MODEL_NOT_FOUND", `Model '${providerId}/${providerLocalModel}' does not exist.`);
    }

    return modelConfig;
  };

  addModel = async (
    providerId: string,
    providerLocalModel: string,
    modelConfig: AigenModelConfig,
  ): Promise<void> => {
    const config = await this.readConfig();
    const providerConfig = config.providers[providerId];

    if (!providerConfig) {
      throw new AigenError("PROVIDER_NOT_FOUND", `Provider '${providerId}' does not exist.`);
    }

    if (providerConfig.models[providerLocalModel]) {
      throw new AigenError("INVALID_ARGUMENT", `Model '${providerId}/${providerLocalModel}' already exists.`);
    }

    providerConfig.models[providerLocalModel] = modelConfig;
    await this.writeConfig(config);
  };

  updateModel = async (
    providerId: string,
    providerLocalModel: string,
    patch: Partial<AigenModelConfig>,
  ): Promise<AigenModelConfig> => {
    const config = await this.readConfig();
    const providerConfig = config.providers[providerId];

    if (!providerConfig) {
      throw new AigenError("PROVIDER_NOT_FOUND", `Provider '${providerId}' does not exist.`);
    }

    const current = providerConfig.models[providerLocalModel];

    if (!current) {
      throw new AigenError("MODEL_NOT_FOUND", `Model '${providerId}/${providerLocalModel}' does not exist.`);
    }

    const next: AigenModelConfig = {
      ...current,
      kind: patch.kind ?? current.kind,
      displayName: patch.displayName ?? current.displayName,
      capabilities: patch.capabilities ?? current.capabilities
    };

    providerConfig.models[providerLocalModel] = next;
    await this.writeConfig(config);
    return next;
  };

  removeModel = async (providerId: string, providerLocalModel: string): Promise<void> => {
    const config = await this.readConfig();
    const providerConfig = config.providers[providerId];

    if (!providerConfig) {
      throw new AigenError("PROVIDER_NOT_FOUND", `Provider '${providerId}' does not exist.`);
    }

    if (!providerConfig.models[providerLocalModel]) {
      throw new AigenError("MODEL_NOT_FOUND", `Model '${providerId}/${providerLocalModel}' does not exist.`);
    }

    delete providerConfig.models[providerLocalModel];
    await this.writeConfig(config);
  };

  clear = async (): Promise<void> => {
    await rm(this.configPath, { force: true });
  };

  private parseConfig = (text: string): AigenConfig => {
    const value = JSON.parse(text) as Partial<AigenConfig>;

    if (value.version !== 1 || !value.providers || typeof value.providers !== "object") {
      throw new AigenError("CONFIG_INVALID", "aigen config.json is invalid.");
    }

    return {
      version: 1,
      providers: value.providers
    };
  };

  private isNotFoundError = (error: unknown): boolean =>
    error instanceof Error && "code" in error && error.code === "ENOENT";
}
